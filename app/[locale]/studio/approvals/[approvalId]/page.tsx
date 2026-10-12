import {notFound} from "next/navigation";
import {routing, type Locale} from "@/lib/i18n/routing";
import {StudioApprovalReview} from "@/components/studio/StudioApprovalReview";
import {approvalCopy} from "@/content/approvals";

export const dynamic = "force-dynamic";
type Props = {params: Promise<{locale: string; approvalId: string}>};
export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  return {title: `${(approvalCopy[locale] ?? approvalCopy.en).title} - Foliant Studio`, robots: {index: false, follow: false}};
}
export default async function ApprovalPage({params}: Props) {
  const {locale, approvalId} = await params;
  if (!routing.locales.includes(locale as Locale) || !/^[a-f0-9-]{36}$/.test(approvalId)) notFound();
  return <StudioApprovalReview locale={locale} approvalId={approvalId} />;
}
