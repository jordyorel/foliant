import "@/components/shared/marketing.css";

export default function LoadingToolPage() {
  return <div className="marketing-site public-page-loading" aria-busy="true" aria-label="Foliant">
    <div className="page-loading-brand">Foliant</div>
    <main><div className="page-loading-heading" /><div className="page-loading-description" /><div className="page-loading-upload" /></main>
  </div>;
}
