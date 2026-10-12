import { redirect } from "next/navigation";

/* The Vault is retired from the product. The route stays so old links land somewhere sensible rather than on a
   404; the contracts, tests and components behind it are untouched, and nothing links here any more. */
export default function VaultRetiredPage() {
  redirect("/app");
}
