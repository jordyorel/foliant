import Link from "next/link";
import {useTranslations} from "next-intl";

type SiteFooterProps = {
  locale: string;
};

export function SiteFooter({locale}: SiteFooterProps) {
  const t = useTranslations("footer");

  return (
    <footer className="footer">
      <span>{t("copyright")}</span>
      <nav aria-label={t("legalLabel")}>
        <Link href={`/${locale}/confidentialite`}>{t("privacy")}</Link>
        <Link href={`/${locale}/conditions`}>{t("terms")}</Link>
        <Link href={`/${locale}/aide`}>{t("help")}</Link>
        <Link href={`/${locale}#pricing`}>{t("pricing")}</Link>
      </nav>
    </footer>
  );
}
