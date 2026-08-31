"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";

const items = [
  {
    key: "convert",
    previewTitle: "contrat-client.pdf",
    from: "PDF",
    to: "DOCX",
    status: "OK"
  },
  {
    key: "compress",
    previewTitle: "rapport-lourd.pdf",
    from: "8.4 MB",
    to: "2.1 MB",
    status: "-75%"
  },
  {
    key: "merge",
    previewTitle: "dossier-client.pdf",
    from: "3 PDF",
    to: "1 PDF",
    status: "Merge"
  },
  {
    key: "sign",
    previewTitle: "contrat-signe.pdf",
    from: "PDF",
    to: "Signé",
    status: "OK"
  }
];

export function LandingAccordion() {
  const t = useTranslations("accordion");
  const [openIndex, setOpenIndex] = useState(0);
  const active = items[openIndex] ?? items[0];

  return (
    <div className="workspace">
      <div className="document-preview" aria-hidden="true">
        <div className="paper">
          <div className="paper-top">
            <span className="file-name">{active.previewTitle}</span>
            <span className="badge">PDF</span>
          </div>
          <div className="line" />
          <div className="line mid" />
          <div className="line" />
          <div className="line short" />
        </div>
        <div className="convert-strip">
          <span className="format">{active.from}</span>
          <i className="ti ti-arrow-right" aria-hidden="true" />
          <span className="format done">{active.to}</span>
        </div>
        <div className="mini-stack">
          <div className="mini-card">
            <span><strong>{t(`${active.key}.action`)}</strong>{t(`${active.key}.detail`)}</span>
            <span className="badge">{active.status}</span>
          </div>
          <div className="mini-card">
            <span><strong>{t("preview.compress")}</strong>8.4 MB → 2.1 MB</span>
            <span className="badge">-75%</span>
          </div>
          <div className="mini-card">
            <span><strong>{t("preview.pages")}</strong>{t("preview.pagesDetail")}</span>
            <span className="badge">Edit</span>
          </div>
        </div>
      </div>

      <div className="accordion">
        {items.map((item, index) => {
          const isOpen = index === openIndex;
          return (
            <div className={`accordion-item${isOpen ? " is-open" : ""}`} key={item.key}>
              <button
                className="accordion-trigger"
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <span>{t(`${item.key}.title`)}</span>
                <i className={`ti ${isOpen ? "ti-minus" : "ti-plus"}`} aria-hidden="true" />
              </button>
              <p className="accordion-panel">{t(`${item.key}.description`)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
