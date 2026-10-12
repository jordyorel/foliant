import Link from "next/link";
import {useTranslations} from "next-intl";
import {tools} from "@/content/tools";
import {getToolEditorial, localize, marketingCopy} from "@/content/tools/editorial";
import {FullToolCatalog} from "@/components/shared/FullToolCatalog";

export function ToolEditorial({slug, locale}: {slug: string; locale: string}) {
  const catalog = useTranslations("catalog");
  const content = getToolEditorial(slug, locale);
  const copy = (key: keyof typeof marketingCopy) => localize(marketingCopy[key], locale);
  return <>
    <section className="section tool-instructions" id="parcours" aria-labelledby="steps-title">
      <h2 id="steps-title">{copy("steps")}</h2>
      <ol className="editorial-steps">
        {[{title: copy("upload"), text: copy("choose"), icon: "ti-upload"}, {title: copy("adjust"), text: content.preparation, icon: "ti-adjustments"}, {title: copy("download"), text: copy("downloadText"), icon: "ti-download"}].map((step, index) => <li key={step.icon}>
          <span className="editorial-step-number">0{index + 1}</span>
          <i className={`ti ${step.icon}`} aria-hidden="true" />
          <h3>{step.title}</h3><p>{step.text}</p>
        </li>)}
      </ol>
    </section>
    <section className="section tool-faq" id="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">{copy("faq")}</h2>
      <div className="faq">
        <details><summary>{copy("limits")}<i className="ti ti-plus" aria-hidden="true" /></summary><p>{content.formats} · {content.limitMB} {copy("fileLimit")}</p></details>
        <details><summary>{content.qualityQuestion}<i className="ti ti-plus" aria-hidden="true" /></summary><p>{content.quality}</p></details>
        <details><summary>{copy("account")}<i className="ti ti-plus" aria-hidden="true" /></summary><p>{copy("accountAnswer")}</p></details>
      </div>
    </section>
    <section className="section tool-related" aria-labelledby="related-title">
      <h2 id="related-title">{copy("related")}</h2>
      <div className="related-tool-links">{content.related.map((related) => <Link key={related} href={`/${locale}/${related}`}><span>{catalog(`tools.${tools[related].labelKey}`)}</span><i className="ti ti-arrow-up-right" aria-hidden="true" /></Link>)}</div>
    </section>
    <section className="section" id="outils" aria-labelledby="tools-title"><h2 id="tools-title">{copy("tools")}</h2><FullToolCatalog locale={locale} /></section>
  </>;
}
