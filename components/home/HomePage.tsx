import Link from "next/link";
import Image from "next/image";
import "@/components/shared/marketing.css";
import {useTranslations} from "next-intl";
import {Header} from "@/components/shared/Header";
import {FullToolCatalog} from "@/components/shared/FullToolCatalog";
import {SiteFooter} from "@/components/shared/SiteFooter";
import {homeCategoryHighlights, homePopularTools} from "@/content/catalog";

type HomePageProps = {
  locale: string;
};

const flowSteps = ["upload", "process", "download"] as const;
const trustItems = ["online", "privacy", "multilingual", "simplePremium"] as const;
const faqItems = ["account", "studio", "privacy", "tools"] as const;

const toolLabelBySlug: Record<string, string> = {
  "pdf-en-word": "pdfToWord",
  "pdf-en-excel": "pdfToExcel",
  "pdf-en-image": "pdfToImage",
  "word-en-pdf": "wordToPdf",
  "image-en-pdf": "imageToPdf",
  "markdown-en-pdf": "markdownToPdf",
  "compresser-pdf": "compressPdf",
  "compresser-image": "compressImage",
  "fusionner-pdf": "mergePdf",
  "diviser-pdf": "splitPdf",
  "filigrane-pdf": "watermark",
  "proteger-pdf": "protectPdf",
  "deverrouiller-pdf": "unlockPdf",
  "signer-pdf": "signPdf",
  "ocr-pdf": "ocrPdf",
  "resumer-document": "summarizeDocument",
  "traduire-pdf": "translatePdf"
};

export function HomePage({locale}: HomePageProps) {
  const t = useTranslations("homepage");
  const catalog = useTranslations("catalog");

  return (
    <div className="marketing-site">
      <Header locale={locale} />
      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <Image className="home-hero-image" src="/images/foliant-paper-hero.webp" alt="" fill sizes="100vw" priority />
          <div className="home-hero-copy">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 id="home-title">{t("title")}</h1>
            <p>{t("subtitle")}</p>
            <div className="home-actions">
              <Link className="home-primary" href={`/${locale}#outils`}>{t("primaryCta")}</Link>
              <Link className="home-secondary" href={`/${locale}/studio`}>{t("secondaryCta")}</Link>
            </div>
          </div>

        </section>

        <section className="home-section compact" id="outils" aria-labelledby="popular-tools-title">
          <div className="home-section-head">
            <span>{t("launcher.kicker")}</span>
            <h2 id="popular-tools-title">{t("launcher.title")}</h2>
            <p>{t("launcher.text")}</p>
          </div>
          <div className="popular-tool-grid">
            {homePopularTools.map((item) => (
              <Link className="popular-tool-card" data-tone={item.tone} href={`/${locale}/${item.slug}`} key={item.slug}>
                <span className="popular-tool-icon"><i className={`ti ${item.icon}`} aria-hidden="true" /></span>
                <span>
                  <strong>{catalog(`tools.${item.label}`)}</strong>
                  <small>{t(`popular.${item.description}`)}</small>
                </span>
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section muted-band" aria-labelledby="categories-title">
          <div className="home-section-head">
            <span>{t("categories.kicker")}</span>
            <h2 id="categories-title">{t("categories.title")}</h2>
            <p>{t("categories.text")}</p>
          </div>
          <div className="home-category-grid">
            {homeCategoryHighlights.map((category) => (
              <article className="home-category-card" key={category.group}>
                <i className={`ti ${category.icon}`} aria-hidden="true" />
                <h3>{catalog(`groups.${category.group}`)}</h3>
                <p>{t(`categories.items.${category.description}`)}</p>
                <div>
                  {category.links.map((slug) => (
                    <Link href={`/${locale}/${slug}`} key={slug}>{catalog(`tools.${toolLabelBySlug[slug]}`)}</Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section split" id="parcours" aria-labelledby="flow-title">
          <div className="home-section-head align-left">
            <span>{t("flow.kicker")}</span>
            <h2 id="flow-title">{t("flow.title")}</h2>
            <p>{t("flow.text")}</p>
          </div>
          <div className="flow-list">
            {flowSteps.map((step, index) => (
              <article className="flow-row" key={step}>
                <span>{index + 1}</span>
                <div>
                  <h3>{t(`flow.steps.${step}.title`)}</h3>
                  <p>{t(`flow.steps.${step}.text`)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section trust-section" aria-labelledby="trust-title">
          <div className="home-section-head">
            <span>{t("trust.kicker")}</span>
            <h2 id="trust-title">{t("trust.title")}</h2>
            <p>{t("trust.text")}</p>
          </div>
          <div className="trust-grid">
            {trustItems.map((item) => (
              <article key={item}>
                <i className={`ti ${item === "online" ? "ti-world" : item === "privacy" ? "ti-trash" : item === "multilingual" ? "ti-language" : "ti-adjustments"}`} aria-hidden="true" />
                <h3>{t(`trust.items.${item}.title`)}</h3>
                <p>{t(`trust.items.${item}.text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section alt" id="faq" aria-labelledby="home-faq-title">
          <div className="section-head">
            <h2 id="home-faq-title">{t("faq.title")}</h2>
          </div>
          <div className="faq">
            {faqItems.map((item) => (
              <details key={item}>
                <summary>{t(`faq.items.${item}.q`)} <i className="ti ti-plus" aria-hidden="true" /></summary>
                <p>{t(`faq.items.${item}.a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="all-tools-title">
          <div className="section-head">
            <h2 id="all-tools-title">{t("allTools.title")}</h2>
          </div>
          <FullToolCatalog locale={locale} />
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
