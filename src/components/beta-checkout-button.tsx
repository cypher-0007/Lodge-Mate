import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  formatBetaPrice,
  getFeeInKobo,
  initiateCheckout,
  verifyAndActivateBetaPass,
  type BetaLodgesConfig,
} from "@/lib/beta-lodges";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

interface BetaCheckoutButtonProps {
  config: BetaLodgesConfig;
  onSuccess?: () => void;
  className?: string;
}

/** Generates a unique payment reference in the form LM-<timestamp>-<random> */
function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LM-${ts}-${rand}`;
}

/** Dynamically loads the Paystack Inline JS script once per page load */
function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Not a browser"));
    if ((window as Window & { PaystackPop?: unknown }).PaystackPop) {
      resolve();
      return;
    }
    const existing = document.getElementById("paystack-inline-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack")));
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-inline-js";
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });
}

export function BetaCheckoutButton({ config, onSuccess, className }: BetaCheckoutButtonProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"idle" | "initiating" | "awaiting_payment" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const activeRef = useRef(false);

  // Reset if user changes
  useEffect(() => {
    setStatus("idle");
    setErrorMsg(null);
  }, [user?.id]);

  const isLive = isSupabaseConfigured();

  if (!isLive) {
    return (
      <Button disabled className={className} variant="outline">
        <Lock className="mr-2 h-4 w-4" />
        Payments require live Supabase
      </Button>
    );
  }

  if (!user) {
    return null; // Parent should show sign-in prompt instead
  }

  const handlePay = async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setStatus("initiating");
    setErrorMsg(null);

    try {
      // 1. Load Paystack script
      await loadPaystackScript();
    } catch {
      setStatus("error");
      setErrorMsg("Could not load payment provider. Check your internet connection and try again.");
      activeRef.current = false;
      return;
    }

    const paymentReference = generateReference();

    // 2. Initiate checkout — snapshots price on backend
    setStatus("initiating");
    const checkoutResult = await initiateCheckout({ paymentReference, provider: "paystack" });

    if (!checkoutResult.success || !checkoutResult.snapshotFeeNgn) {
      setStatus("error");
      setErrorMsg(checkoutResult.error ?? "Failed to start checkout. Please try again.");
      activeRef.current = false;
      return;
    }

    const amountKobo = getFeeInKobo(checkoutResult.snapshotFeeNgn);
    const paystackKey = import.meta.env["VITE_PAYSTACK_PUBLIC_KEY"] as string | undefined;

    if (!paystackKey) {
      setStatus("error");
      setErrorMsg("Payment configuration is incomplete. Please contact support.");
      activeRef.current = false;
      return;
    }

    // 3. Open Paystack popup with snapshot amount
    setStatus("awaiting_payment");

    const PaystackPop = (window as Window & { PaystackPop?: { setup: (opts: unknown) => { openIframe: () => void } } }).PaystackPop;
    if (!PaystackPop) {
      setStatus("error");
      setErrorMsg("Payment provider failed to initialize. Please refresh and try again.");
      activeRef.current = false;
      return;
    }

    const handler = PaystackPop.setup({
      key: paystackKey,
      email: user.email ?? `${user.id}@lodgemate.app`,
      amount: amountKobo,
      currency: checkoutResult.snapshotCurrency ?? "NGN",
      ref: paymentReference,
      metadata: {
        custom_fields: [
          { display_name: "Product", variable_name: "product", value: "LodgeMate Beta Access Pass" },
        ],
      },
      onSuccess: async () => {
        // 4. Verify server-side and issue pass
        setStatus("verifying");
        const verifyResult = await verifyAndActivateBetaPass({
          paymentReference,
          provider: "paystack",
        });

        if (verifyResult.success) {
          setStatus("success");
          // Invalidate access queries so the UI updates immediately
          await qc.invalidateQueries({ queryKey: ["user-beta-access"] });
          await qc.invalidateQueries({ queryKey: ["beta-access-pass"] });
          toast.success("Beta Access Pass activated!", {
            description: `Your pass is valid for ${checkoutResult.snapshotDurationDays} days.`,
          });
          onSuccess?.();
        } else {
          setStatus("error");
          setErrorMsg(verifyResult.error ?? "Payment verification failed. Contact support with your reference.");
          toast.error("Verification failed", { description: verifyResult.error });
        }
        activeRef.current = false;
      },
      onClose: () => {
        if (status === "awaiting_payment" || status === "initiating") {
          setStatus("idle");
          setErrorMsg(null);
          toast.info("Payment cancelled", { description: "You can try again whenever you are ready." });
        }
        activeRef.current = false;
      },
    });

    handler.openIframe();
  };

  if (status === "success") {
    return (
      <Button disabled className={className} variant="outline">
        ✓ Access pass activated
      </Button>
    );
  }

  const isLoading = status === "initiating" || status === "awaiting_payment" || status === "verifying";
  const loadingLabel =
    status === "initiating"
      ? "Starting checkout…"
      : status === "awaiting_payment"
        ? "Waiting for payment…"
        : "Verifying payment…";

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => void handlePay()}
        disabled={isLoading}
        className={`bg-warning text-warning-foreground hover:bg-warning/90 ${className ?? ""}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            Get Access — {formatBetaPrice(config.access_fee_ngn)}
          </>
        )}
      </Button>
      {errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}

