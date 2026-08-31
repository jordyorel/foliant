import Link from "next/link";
import {useTranslations} from "next-intl";
import {Header} from "@/components/shared/Header";
import {LandingAccordion} from "./LandingAccordion";
import {UploadDropzone} from "@/components/uploader/UploadDropzone";
import {MergeUploader} from "@/components/uploader/MergeUploader";
import {SplitUploader} from "@/components/uploader/SplitUploader";
import {tools} from "@/content/tools";
import {getToolAction} from "@/content/tools/actions";

type LandingPageProps = {
  locale: string;
  activeTool?: string;
};

export function LandingPage({locale, activeTool}: LandingPageProps) {
  const t = useTranslations("home");
  const catalog = useTranslations("catalog");
  const tool = activeTool ? tools[activeTool] : undefined;
  const heroTitle = tool ? catalog(`tools.${tool.labelKey}`) : t("title");
  const heroSubtitle = tool ? t("toolSubtitle") : t("subtitle");
  const uploadTitle = tool ? t("toolUploadTitle") : t("uploadTitle");
  const uploadNote = tool ? t("toolUploadNote") : t("uploadNote");
  const accept = tool?.accept ?? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.heic,.md";
  const toolAction = getToolAction(activeTool);

  return (
    <>
      <Header locale={locale} />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            {!tool ? <p className="eyebrow">{t("eyebrow")}</p> : null}
            <h1 id="hero-title">{heroTitle}</h1>
            <p>{heroSubtitle}</p>
          </div>
          {toolAction === "merge_pdf" ? (
            <MergeUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.merge.add"),
                close: t("upload.close"),
                uploadingTitle: t("upload.merge.uploading"),
                readyTitle: t("upload.merge.order"),
                mergingTitle: t("upload.merge.merging"),
                successTitle: t("upload.merge.done"),
                successSubtitle: t("upload.merge.successSubtitle"),
                filesCount: t("upload.merge.filesCount"),
                totalSize: t("upload.merge.totalSize"),
                onePdf: t("upload.merge.onePdf"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.merge.another"),
                merge: t("upload.merge.merge"),
                moveUp: t("upload.merge.moveUp"),
                moveDown: t("upload.merge.moveDown"),
                remove: t("upload.merge.remove"),
                empty: t("upload.merge.empty"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "split_pdf" ? (
            <SplitUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("uploadButton"),
                close: t("upload.close"),
                title: t("upload.split.title"),
                uploading: t("upload.split.uploading"),
                splitting: t("upload.split.splitting"),
                done: t("upload.split.done"),
                successSubtitle: t("upload.split.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                selectMethod: t("upload.split.selectMethod"),
                everyPage: t("upload.split.everyPage"),
                everyPageText: t("upload.split.everyPageText"),
                interval: t("upload.split.interval"),
                intervalText: t("upload.split.intervalText"),
                range: t("upload.split.range"),
                rangeText: t("upload.split.rangeText"),
                intervalLabel: t("upload.split.intervalLabel"),
                rangeLabel: t("upload.split.rangeLabel"),
                rangePlaceholder: t("upload.split.rangePlaceholder"),
                split: t("upload.split.split"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.split.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : (
            <UploadDropzone
              title={uploadTitle}
              button={t("uploadButton")}
              note={uploadNote}
              accept={accept}
              tool={toolAction}
              labels={{
                selected: t("upload.selected"),
                start: t("upload.start"),
                uploading: t("upload.uploading"),
                queued: t("upload.queued"),
                processing: t("upload.processing"),
                completed: t("upload.completed"),
                download: t("upload.download"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile"),
                alreadyOptimizedBadge: t("upload.alreadyOptimizedBadge"),
                original: t("upload.original"),
                final: t("upload.final"),
                saved: t("upload.saved"),
                close: t("upload.close"),
                compressionUploadingTitle: t("upload.compression.uploadingTitle"),
                compressionPreparing: t("upload.compression.preparing"),
                compressionFileName: t("upload.compression.fileName"),
                compressionCurrentSize: t("upload.compression.currentSize"),
                compressionSelectLevel: t("upload.compression.selectLevel"),
                compressionBestSize: t("upload.compression.bestSize"),
                compressionBestSizeText: t("upload.compression.bestSizeText"),
                compressionBestQuality: t("upload.compression.bestQuality"),
                compressionBestQualityText: t("upload.compression.bestQualityText"),
                compressionCompress: t("upload.compression.compress"),
                compressionCompressingTitle: t("upload.compression.compressingTitle"),
                compressionCompletedTitle: t("upload.compression.completedTitle"),
                compressionCompletedText: t("upload.compression.completedText"),
                compressionAlreadyOptimizedText: t("upload.compression.alreadyOptimizedText"),
                compressionEmailTitle: t("upload.compression.emailTitle"),
                compressionEmailPlaceholder: t("upload.compression.emailPlaceholder"),
                compressionTerms: t("upload.compression.terms"),
                compressionContinue: t("upload.compression.continue"),
                compressionLoginText: t("upload.compression.loginText"),
                compressionLogin: t("upload.compression.login"),
                compressionAnother: t("upload.compression.another")
              }}
            />
          )}
          <div className="trust-row" aria-label={t("statsLabel")}>
            <span><strong>2 min</strong>{t("statFast")}</span>
            <span><strong>0 app</strong>{t("statInstall")}</span>
            <span><strong>6 h</strong>{t("statDelete")}</span>
          </div>
        </section>

        <section className="section" aria-labelledby="workspace-title">
          <div className="section-head">
            <h2 id="workspace-title">{t("workspaceTitle")}</h2>
            <p>{t("workspaceText")}</p>
          </div>
          <LandingAccordion />
        </section>

        <section className="section" id="parcours" aria-labelledby="steps-title">
          <div className="section-head">
            <h2 id="steps-title">{t("stepsTitle")}</h2>
            <p>{t("stepsText")}</p>
          </div>
          <div className="steps">
            {["upload", "choose", "download"].map((key, index) => (
              <div className="step-card" key={key}>
                <div>
                  <span className="step-number">{index + 1}</span>
                  <h3>{t(`steps.${key}.title`)}</h3>
                  <p>{t(`steps.${key}.text`)}</p>
                </div>
                <div className="step-visual">
                  <div className="step-file">
                    <span>{t(`steps.${key}.file`)}</span>
                    <i className={`ti ${index === 0 ? "ti-upload" : index === 1 ? "ti-settings" : "ti-download"}`} aria-hidden="true" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section alt" id="faq" aria-labelledby="faq-title">
          <div className="section-head">
            <h2 id="faq-title">{t("faqTitle")}</h2>
          </div>
          <div className="faq">
            {["free", "install", "privacy", "signature"].map((key) => (
              <details key={key}>
                <summary>{t(`faq.${key}.q`)} <i className="ti ti-plus" aria-hidden="true" /></summary>
                <p>{t(`faq.${key}.a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section" id="outils" aria-labelledby="tools-title">
          <div className="section-head">
            <h2 id="tools-title">{t("toolsTitle")}</h2>
            <p>{t("toolsText")}</p>
          </div>
          <div className="tool-grid" aria-label={t("popularTools")}>
            <Link className="tool-card" href={`/${locale}/pdf-en-word`}><i className="ti ti-refresh" aria-hidden="true" /><span>{catalog("tools.pdfToWord")}</span></Link>
            <Link className="tool-card" href={`/${locale}/compresser-pdf`}><i className="ti ti-arrows-diagonal-minimize-2" aria-hidden="true" /><span>{catalog("tools.compressPdf")}</span></Link>
            <Link className="tool-card" href={`/${locale}/fusionner-pdf`}><i className="ti ti-stack-2" aria-hidden="true" /><span>{catalog("tools.mergePdf")}</span></Link>
            <Link className="tool-card" href={`/${locale}/signer-pdf`}><i className="ti ti-signature" aria-hidden="true" /><span>{catalog("tools.signPdf")}</span></Link>
          </div>
          <div className="catalog">
            <div><h3>{catalog("groups.fromPdf")}</h3><Link href={`/${locale}/pdf-en-word`}>{catalog("tools.pdfToWord")}</Link><Link href={`/${locale}/pdf-en-excel`}>{catalog("tools.pdfToExcel")}</Link><Link href={`/${locale}/pdf-en-powerpoint`}>{catalog("tools.pdfToPowerpoint")}</Link><Link href={`/${locale}/pdf-en-image`}>{catalog("tools.pdfToImage")}</Link></div>
            <div><h3>{catalog("groups.toPdf")}</h3><Link href={`/${locale}/word-en-pdf`}>{catalog("tools.wordToPdf")}</Link><Link href={`/${locale}/excel-en-pdf`}>{catalog("tools.excelToPdf")}</Link><Link href={`/${locale}/powerpoint-en-pdf`}>{catalog("tools.powerpointToPdf")}</Link><Link href={`/${locale}/image-en-pdf`}>{catalog("tools.imageToPdf")}</Link></div>
            <div><h3>{catalog("groups.compress")}</h3><Link href={`/${locale}/compresser-pdf`}>{catalog("tools.compressPdf")}</Link><Link href={`/${locale}/compresser-image`}>{catalog("tools.compressImage")}</Link></div>
            <div><h3>{catalog("groups.edit")}</h3><Link href={`/${locale}/fusionner-pdf`}>{catalog("tools.mergePdf")}</Link><Link href={`/${locale}/diviser-pdf`}>{catalog("tools.splitPdf")}</Link><Link href={`/${locale}/reorganiser-pdf`}>{catalog("tools.reorderPdf")}</Link><Link href={`/${locale}/supprimer-pages-pdf`}>{catalog("tools.deletePages")}</Link><Link href={`/${locale}/filigrane-pdf`}>{catalog("tools.watermark")}</Link><Link href={`/${locale}/numeroter-pages-pdf`}>{catalog("tools.pageNumbers")}</Link></div>
            <div><h3>{catalog("groups.secure")}</h3><Link href={`/${locale}/proteger-pdf`}>{catalog("tools.protectPdf")}</Link><Link href={`/${locale}/deverrouiller-pdf`}>{catalog("tools.unlockPdf")}</Link><Link href={`/${locale}/signer-pdf`}>{catalog("tools.signPdf")}</Link></div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <span>© 2026 Foliant</span>
        <nav aria-label="Liens légaux">
          <Link href={`/${locale}/confidentialite`}>Confidentialité</Link>
          <Link href={`/${locale}/conditions`}>Conditions</Link>
          <Link href={`/${locale}/aide`}>Aide</Link>
        </nav>
      </footer>
    </>
  );
}
