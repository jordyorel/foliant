import {LandingPage} from "@/components/tool/LandingPage";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  return <LandingPage locale={locale} />;
}
