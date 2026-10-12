import Link from "next/link";
import {useTranslations} from "next-intl";
import {fullCatalogSections} from "@/content/catalog";

type FullToolCatalogProps = {
  locale: string;
};

export function FullToolCatalog({locale}: FullToolCatalogProps) {
  const catalog = useTranslations("catalog");

  return (
    <div className="catalog">
      {fullCatalogSections.map((section) => (
        <div key={section.group}>
          <h3>{catalog(`groups.${section.group}`)}</h3>
          {section.links.map(({slug, label, available}) => available ? (
            <Link key={slug} href={`/${locale}/${slug}`}>{catalog(`tools.${label}`)}</Link>
          ) : (
            <span className="catalog-item-soon" key={slug} aria-label={`${catalog(`tools.${label}`)} — ${catalog("comingSoon")}`}>
              <span>{catalog(`tools.${label}`)}</span>
              <small>{catalog("comingSoon")}</small>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
