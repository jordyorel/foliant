import Link from "next/link";
import {useTranslations} from "next-intl";
import {catalogSections} from "@/content/catalog";

type FullToolCatalogProps = {
  locale: string;
};

export function FullToolCatalog({locale}: FullToolCatalogProps) {
  const catalog = useTranslations("catalog");

  return (
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
  );
}
