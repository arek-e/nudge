import { faqItems, faqSeo, homeSeo, marketingSite } from "./marketing-content";

function absoluteUrl(path: string) {
  return new URL(path, marketingSite.origin).toString();
}

const homeUrl = absoluteUrl(marketingSite.homePath);
const faqUrl = absoluteUrl(marketingSite.faqPath);
const imageUrl = absoluteUrl(marketingSite.imagePath);
const logoUrl = absoluteUrl(marketingSite.logoPath);

const baseProductKeywords =
  "AI productivity app, sticky notes app, notes to tasks, notes to reminders, AI task manager, follow-up app, personal productivity";

function socialMeta(props: {
  readonly description: string;
  readonly title: string;
  readonly url: string;
}) {
  return [
    { content: marketingSite.name, property: "og:site_name" },
    { content: "website", property: "og:type" },
    { content: props.url, property: "og:url" },
    { content: props.title, property: "og:title" },
    { content: props.description, property: "og:description" },
    { content: imageUrl, property: "og:image" },
    {
      content: "nudge sticky notes turning into reviewed next steps",
      property: "og:image:alt",
    },
    { content: "summary_large_image", name: "twitter:card" },
    { content: props.title, name: "twitter:title" },
    { content: props.description, name: "twitter:description" },
    { content: imageUrl, name: "twitter:image" },
    {
      content: "nudge sticky notes turning into reviewed next steps",
      name: "twitter:image:alt",
    },
  ];
}

export function rootMeta() {
  return [
    { charSet: "utf-8" },
    { content: "width=device-width, initial-scale=1, viewport-fit=cover", name: "viewport" },
    {
      content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
      name: "robots",
    },
    { content: marketingSite.themeColor, name: "theme-color" },
    { content: marketingSite.name, name: "application-name" },
    { content: marketingSite.name, name: "apple-mobile-web-app-title" },
  ];
}

export function rootLinks(stylesheetHref: string) {
  return [
    { href: stylesheetHref, rel: "stylesheet" },
    { href: marketingSite.logoPath, rel: "icon", type: "image/svg+xml" },
  ];
}

export function homeLinks() {
  return [{ href: homeUrl, rel: "canonical" }];
}

export function faqLinks() {
  return [{ href: faqUrl, rel: "canonical" }];
}

export function homeMeta() {
  return [
    { title: homeSeo.title },
    { content: homeSeo.description, name: "description" },
    { content: baseProductKeywords, name: "keywords" },
    ...socialMeta({
      description: homeSeo.description,
      title: homeSeo.title,
      url: homeUrl,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": `${homeUrl}#organization`,
            "@type": "Organization",
            logo: logoUrl,
            name: marketingSite.name,
            url: homeUrl,
          },
          {
            "@id": `${homeUrl}#website`,
            "@type": "WebSite",
            description: homeSeo.description,
            inLanguage: "en-US",
            name: marketingSite.name,
            publisher: {
              "@id": `${homeUrl}#organization`,
            },
            url: homeUrl,
          },
          {
            "@id": `${homeUrl}#software`,
            "@type": "SoftwareApplication",
            applicationCategory: "ProductivityApplication",
            applicationSubCategory: "AI productivity app",
            audience: {
              "@type": "Audience",
              audienceType:
                "People who capture notes, reminders, tasks, and follow-ups for later review",
            },
            description: homeSeo.description,
            featureList: [
              "Turn sticky notes into reminders",
              "Turn loose thoughts into tasks",
              "Draft follow-ups for review",
              "Keep suggested actions tied to the original note",
              "Require approval before commitments change",
            ],
            image: imageUrl,
            keywords: baseProductKeywords,
            name: marketingSite.name,
            operatingSystem: "Web, macOS, iOS, Raycast",
            potentialAction: {
              "@type": "UseAction",
              target: marketingSite.appHref,
            },
            url: homeUrl,
          },
        ],
      },
    },
  ];
}

export function faqMeta() {
  return [
    { title: faqSeo.title },
    { content: faqSeo.description, name: "description" },
    { content: `${baseProductKeywords}, nudge FAQ`, name: "keywords" },
    ...socialMeta({
      description: faqSeo.description,
      title: faqSeo.title,
      url: faqUrl,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@id": `${faqUrl}#faq`,
        "@type": "FAQPage",
        inLanguage: "en-US",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
          name: item.question,
        })),
      },
    },
  ];
}
