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
import {NumberPagesUploader} from "@/components/uploader/NumberPagesUploader";
import {WatermarkUploader} from "@/components/uploader/WatermarkUploader";
import {PasswordPdfUploader} from "@/components/uploader/PasswordPdfUploader";
import {HeicToImageUploader} from "@/components/uploader/HeicToImageUploader";
import {FullToolCatalog} from "@/components/shared/FullToolCatalog";
import {SiteFooter} from "@/components/shared/SiteFooter";
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
          ) : toolAction === "number_pdf_pages" ? (
            <NumberPagesUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.pageNumbers.add"),
                close: t("upload.close"),
                title: t("upload.pageNumbers.title"),
                uploading: t("upload.pageNumbers.uploading"),
                processing: t("upload.pageNumbers.processing"),
                done: t("upload.pageNumbers.done"),
                successSubtitle: t("upload.pageNumbers.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                selectPosition: t("upload.pageNumbers.selectPosition"),
                bottomLeft: t("upload.pageNumbers.bottomLeft"),
                bottomCenter: t("upload.pageNumbers.bottomCenter"),
                bottomRight: t("upload.pageNumbers.bottomRight"),
                topLeft: t("upload.pageNumbers.topLeft"),
                topCenter: t("upload.pageNumbers.topCenter"),
                topRight: t("upload.pageNumbers.topRight"),
                startPageLabel: t("upload.pageNumbers.startPageLabel"),
                startNumberLabel: t("upload.pageNumbers.startNumberLabel"),
                submit: t("upload.pageNumbers.submit"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.pageNumbers.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "watermark_pdf" ? (
            <WatermarkUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.watermark.add"),
                close: t("upload.close"),
                title: t("upload.watermark.title"),
                uploading: t("upload.watermark.uploading"),
                processing: t("upload.watermark.processing"),
                done: t("upload.watermark.done"),
                successSubtitle: t("upload.watermark.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                textLabel: t("upload.watermark.textLabel"),
                textPlaceholder: t("upload.watermark.textPlaceholder"),
                selectPosition: t("upload.watermark.selectPosition"),
                center: t("upload.watermark.center"),
                centerText: t("upload.watermark.centerText"),
                diagonal: t("upload.watermark.diagonal"),
                diagonalText: t("upload.watermark.diagonalText"),
                repeated: t("upload.watermark.repeated"),
                repeatedText: t("upload.watermark.repeatedText"),
                opacityLabel: t("upload.watermark.opacityLabel"),
                submit: t("upload.watermark.submit"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.watermark.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile")
              }}
            />
          ) : toolAction === "protect_pdf" || toolAction === "unlock_pdf" ? (
            <PasswordPdfUploader
              tool={toolAction}
              mode={toolAction === "protect_pdf" ? "protect" : "unlock"}
              accept={accept}
              note={uploadNote}
              labels={{
                add: toolAction === "protect_pdf" ? t("upload.protect.add") : t("upload.unlock.add"),
                close: t("upload.close"),
                title: toolAction === "protect_pdf" ? t("upload.protect.title") : t("upload.unlock.title"),
                uploading: toolAction === "protect_pdf" ? t("upload.protect.uploading") : t("upload.unlock.uploading"),
                processing: toolAction === "protect_pdf" ? t("upload.protect.processing") : t("upload.unlock.processing"),
                done: toolAction === "protect_pdf" ? t("upload.protect.done") : t("upload.unlock.done"),
                successSubtitle: toolAction === "protect_pdf" ? t("upload.protect.successSubtitle") : t("upload.unlock.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                passwordLabel: toolAction === "protect_pdf" ? t("upload.protect.passwordLabel") : t("upload.unlock.passwordLabel"),
                passwordPlaceholder: toolAction === "protect_pdf" ? t("upload.protect.passwordPlaceholder") : t("upload.unlock.passwordPlaceholder"),
                confirmLabel: t("upload.protect.confirmLabel"),
                confirmPlaceholder: t("upload.protect.confirmPlaceholder"),
                mismatch: t("upload.protect.mismatch"),
                submit: toolAction === "protect_pdf" ? t("upload.protect.submit") : t("upload.unlock.submit"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: toolAction === "protect_pdf" ? t("upload.protect.another") : t("upload.unlock.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile"),
                errorQpdfMissing: t("upload.errorQpdfMissing")
              }}
            />
          ) : toolAction === "heic_to_jpg" || toolAction === "heic_to_png" ? (
            <HeicToImageUploader
              tool={toolAction}
              accept={accept}
              note={uploadNote}
              labels={{
                add: t("upload.heic.add"),
                close: t("upload.close"),
                title: t("upload.heic.title"),
                uploading: t("upload.heic.uploading"),
                processing: t("upload.heic.processing"),
                done: t("upload.heic.done"),
                successSubtitle: t("upload.heic.successSubtitle"),
                fileName: t("upload.compression.fileName"),
                currentSize: t("upload.compression.currentSize"),
                convert: t("upload.heic.convert"),
                download: t("upload.download"),
                emailTitle: t("upload.compression.emailTitle"),
                emailPlaceholder: t("upload.compression.emailPlaceholder"),
                terms: t("upload.compression.terms"),
                continue: t("upload.compression.continue"),
                loginText: t("upload.compression.loginText"),
                login: t("upload.compression.login"),
                another: t("upload.heic.another"),
                error: t("upload.error"),
                errorTooLarge: t("upload.errorTooLarge"),
                errorUnsupportedType: t("upload.errorUnsupportedType"),
                errorInvalidFile: t("upload.errorInvalidFile"),
                errorHeicDecoderMissing: t("upload.errorHeicDecoderMissing")
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
          <FullToolCatalog locale={locale} />
        </section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
