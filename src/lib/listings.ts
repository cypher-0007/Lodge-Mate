import selfconImage from "@/assets/listing-selfcon.jpg";
import bedspaceImage from "@/assets/listing-bedspace.jpg";
import apartmentImage from "@/assets/listing-apartment.jpg";
import lodgeImage from "@/assets/listing-lodge.jpg";

export type Listing = {
  id: string;
  title: string;
  kind: "Full lodge" | "Bedspace" | "Takeover";
  school: "MOUAU" | "ABSU";
  area: string;
  distance: string;
  price: string;
  period: string;
  image: string;
  verified: boolean;
  amenities: string[];
  description: string;
  host: { name: string; role: string; since: string };
};

export const listings: Listing[] = [
  {
    id: "palmview-selfcon",
    title: "PalmView Self-Con, Ishiagu Gate",
    kind: "Full lodge",
    school: "MOUAU",
    area: "Ishiagu",
    distance: "6 min walk",
    price: "₦280,000",
    period: "per year",
    image: selfconImage,
    verified: true,
    amenities: ["Prepaid meter", "Borehole", "Tiled", "Wardrobe", "Bathroom ensuite"],
    description:
      "Newly finished self-contained room in a 12-room lodge just off Ishiagu gate. Prepaid meter, steady borehole water and a fenced compound with a caretaker on site.",
    host: { name: "Mr. Emeka O.", role: "Landlord", since: "Listing since 2023" },
  },
  {
    id: "ziks-bedspace",
    title: "Bedspace in 2-man room, Zik's Flat",
    kind: "Bedspace",
    school: "ABSU",
    area: "Uturu",
    distance: "10 min bike",
    price: "₦95,000",
    period: "per session",
    image: bedspaceImage,
    verified: true,
    amenities: ["Female only", "Fenced", "Study desk", "Shared kitchen"],
    description:
      "One bedspace open in a quiet 2-man room shared with a 300-level student. Female only, study desks included, rent covers the full session.",
    host: { name: "Chiamaka N.", role: "Student host", since: "Verified student" },
  },
  {
    id: "umudike-takeover",
    title: "Takeover: 1-bedroom, 7 months left",
    kind: "Takeover",
    school: "MOUAU",
    area: "Umudike",
    distance: "12 min walk",
    price: "₦185,000",
    period: "remaining tenancy",
    image: apartmentImage,
    verified: false,
    amenities: ["Kitchen", "Water heater", "Parking", "Balcony"],
    description:
      "Graduating and transferring the remaining 7 months on my one-bedroom. Fittings stay, landlord has agreed to the transfer — paperwork done at inspection.",
    host: { name: "Ifeanyi A.", role: "Current tenant", since: "Awaiting verification" },
  },
  {
    id: "green-court",
    title: "Green Court Lodge — 4 rooms left",
    kind: "Full lodge",
    school: "ABSU",
    area: "Uturu main road",
    distance: "4 min walk",
    price: "₦210,000",
    period: "per year",
    image: lodgeImage,
    verified: true,
    amenities: ["Gated", "Security", "Solar backup", "Prepaid meter"],
    description:
      "Purpose-built student lodge on Uturu main road with 24-hour security, solar backup for lights and fans, and four rooms still open for the new session.",
    host: { name: "Bright Homes Agency", role: "Verified agent", since: "42 listings hosted" },
  },
];

export const getListing = (id: string) => listings.find((l) => l.id === id);
