import Link from "next/link";
import {useTranslations} from "next-intl";
import {Header} from "@/components/shared/Header";
import {LandingAccordion} from "./LandingAccordion";
import {UploadDropzone} from "@/components/uploader/UploadDropzone";
import {MergeUploader} from "@/components/uploader/MergeUploader";
import {SplitUploader} from "@/components/uploader/SplitUploader";
import {ImageToPdfUploader} from "@/components/uploader/ImageToPdfUploader";
import {PdfToImageUploader} from "@/components/uploader/PdfToImageUploader";
import {RotateUploader} from "@/components/uploader/RotateUploader";
import {PageRangeUploader} from "@/components/uploader/PageRangeUploader";
import {tools} from "@/content/tools";
import {getToolAction} from "@/content/tools/actions";

type LandingPageProps = {
  locale: string;
  activeTool?: string;
};

const catalogSections = [
  {
    group: "fromPdf",
    links: [
      ["pdf-en-word", "pdfToWord"],
      ["pdf-en-excel", "pdfToExcel"],
      ["pdf-en-powerpoint", "pdfToPowerpoint"],
      ["pdf-en-image", "pdfToImage"],
      ["pdf-en-jpg", "pdfToJpg"],
      ["pdf-en-png", "pdfToPng"]
    ]
  },
  {
    group: "toPdf",
    links: [
      ["word-en-pdf", "wordToPdf"],
      ["excel-en-pdf", "excelToPdf"],
      ["powerpoint-en-pdf", "powerpointToPdf"],
      ["image-en-pdf", "imageToPdf"],
      ["jpg-en-pdf", "jpgToPdf"],
      ["png-en-pdf", "pngToPdf"],
      ["markdown-en-pdf", "markdownToPdf"]
    ]
  },
  {
    group: "compress",
    links: [
      ["compresser-pdf", "compressPdf"],
      ["compresser-image", "compressImage"]
    ]
  },
  {
    group: "edit",
    links: [
      ["fusionner-pdf", "mergePdf"],
      ["diviser-pdf", "splitPdf"],
      ["reorganiser-pdf", "reorderPdf"],
      ["pivoter-pdf", "rotatePdf"],
      ["supprimer-pages-pdf", "deletePages"],
      ["extraire-pages-pdf", "extractPages"],
      ["inserer-pages-pdf", "insertPages"],
      ["filigrane-pdf", "watermark"],
      ["numeroter-pages-pdf", "pageNumbers"],
      ["ajouter-texte-pdf", "addText"],
      ["remplir-pdf", "fillPdf"]
    ]
  },
  {
    group: "secure",
    links: [
      ["proteger-pdf", "protectPdf"],
      ["deverrouiller-pdf", "unlockPdf"],
      ["signer-pdf", "signPdf"]
    ]
  },
  {
    group: "image",
    links: [
      ["heic-en-jpg", "heicToJpg"],
      ["heic-en-png", "heicToPng"]
    ]
  },
  {
    group: "ai",
    links: [
      ["image-en-texte", "imageToText"],
      ["ocr-pdf", "ocrPdf"],
      ["resumer-document", "summarizeDocument"],
      ["traduire-pdf", "translatePdf"]
    ]
  }
] as const;

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
          ) : toolAction === "image_to_pdf" ? (
            <ImageToPdfUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.imagePdf.add"),
                close: t("upload.close"),
                uploadingTitle: t("upload.imagePdf.uploading"),
                readyTitle: t("upload.imagePdf.order"),
                creatingTitle: t("upload.imagePdf.creating"),
                successTitle: t("upload.imagePdf.done"),
                successSubtitle: t("upload.imagePdf.successSubtitle"),
                filesCount: t("upload.imagePdf.filesCount"),
                totalSize: t("upload.imagePdf.totalSize"),
                onePdf: t("upload.imagePdf.onePdf"),
                create: t("upload.imagePdf.create"),
                moveUp: t("upload.imagePdf.moveUp"),
                moveDown: t("upload.imagePdf.moveDown"),
                remove: t("upload.imagePdf.remove"),
                empty: t("upload.imagePdf.empty"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.imagePdf.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "pdf_to_image" ? (
            <PdfToImageUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              defaultFormat={activeTool === "pdf-en-png" ? "png" : "jpg"}
              labels={{
                add: t("upload.pdfToImage.add"),
                close: t("upload.close"),
                uploading: t("upload.pdfToImage.uploading"),
                readyTitle: t("upload.pdfToImage.readyTitle"),
                selectFormat: t("upload.pdfToImage.selectFormat"),
                jpg: t("upload.pdfToImage.jpg"),
                jpgText: t("upload.pdfToImage.jpgText"),
                png: t("upload.pdfToImage.png"),
                pngText: t("upload.pdfToImage.pngText"),
                convert: t("upload.pdfToImage.convert"),
                converting: t("upload.pdfToImage.converting"),
                done: t("upload.pdfToImage.done"),
                successSubtitle: t("upload.pdfToImage.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.pdfToImage.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "rotate_pdf" ? (
            <RotateUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.rotate.add"),
                close: t("upload.close"),
                title: t("upload.rotate.title"),
                uploading: t("upload.rotate.uploading"),
                rotating: t("upload.rotate.rotating"),
                done: t("upload.rotate.done"),
                successSubtitle: t("upload.rotate.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                selectAngle: t("upload.rotate.selectAngle"),
                right: t("upload.rotate.right"),
                rightText: t("upload.rotate.rightText"),
                half: t("upload.rotate.half"),
                halfText: t("upload.rotate.halfText"),
                left: t("upload.rotate.left"),
                leftText: t("upload.rotate.leftText"),
                rotate: t("upload.rotate.rotate"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.rotate.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "extract_pdf_pages" ? (
            <PageRangeUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.extract.add"),
                close: t("upload.close"),
                title: t("upload.extract.title"),
                uploading: t("upload.extract.uploading"),
                processing: t("upload.extract.processing"),
                done: t("upload.extract.done"),
                successSubtitle: t("upload.extract.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                selectLabel: t("upload.extract.selectLabel"),
                rangeLabel: t("upload.extract.rangeLabel"),
                rangePlaceholder: t("upload.extract.rangePlaceholder"),
                submit: t("upload.extract.submit"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.extract.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "delete_pdf_pages" ? (
            <PageRangeUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.delete.add"),
                close: t("upload.close"),
                title: t("upload.delete.title"),
                uploading: t("upload.delete.uploading"),
                processing: t("upload.delete.processing"),
                done: t("upload.delete.done"),
                successSubtitle: t("upload.delete.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                selectLabel: t("upload.delete.selectLabel"),
                rangeLabel: t("upload.delete.rangeLabel"),
                rangePlaceholder: t("upload.delete.rangePlaceholder"),
                submit: t("upload.delete.submit"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.delete.another"),
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
            {catalogSections.map((section) => (
              <div key={section.group}>
                <h3>{catalog(`groups.${section.group}`)}</h3>
                {section.links.map(([slug, label]) => (
                  <Link key={slug} href={`/${locale}/${slug}`}>{catalog(`tools.${label}`)}</Link>
                ))}
              </div>
            ))}
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
