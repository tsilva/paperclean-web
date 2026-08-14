import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return <main className="page-canvas inner-canvas"><section className="legal-shell compact-message"><Brand /><h1>That page is not here.</h1><p>PaperClean keeps the product intentionally small.</p><Link className="primary-button" href="/">Return home</Link></section></main>;
}
