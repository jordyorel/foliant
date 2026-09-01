import {HomePage as MarketingHomePage} from "@/components/home/HomePage";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  return <MarketingHomePage locale={locale} />;
}
