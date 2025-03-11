import { Context, Hono } from "hono";

import * as cheerio from "cheerio";
type Bindings = {
  NEWS_URL: string;
  REDIRECT_URL: string;
};

export interface PlaceToRead {
  siteTitle?: string;
  logo?: string;
  url?: string;
}

export interface NewsData {
  image?: string;
  title?: string;
  description?: string;
  publishedTime?: string;
  placesToRead?: PlaceToRead[];
  imageSource?: string;
}

async function getHTML(url: string) {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error("Error fetching HTML:", error);
    return null;
  }
}

async function extractNewsData(
  url: string,
  c: Context
): Promise<NewsData[] | null> {
  if (!url) {
    console.error("NEWS_URL is not set.");
    return null;
  }

  const html = await getHTML(url);
  if (!html) {
    console.error("HTML is null or empty.");
    return null;
  }

  const $ = cheerio.load(html);
  const newsData: NewsData[] = [];

  $(
    "#news-stories-list-wrapper > .news-stories-list-story > .news-story-item"
  ).each((_, element) => {
    const image = $(element)
      .find(".news-image-wrapper")
      .css("background")
      ?.replace(/^url\(['"]?(https?:\/\/[^"')]+)["']?\)/, "$1");
    const imageSource = $(element)
      .find(".news-story-image-source")
      .text()
      .trim();
    const title = $(element).find(".news-story-title").text().trim();
    const description = $(element).find(".text-lg").text().trim();
    const publishedTime = $(element).find(".news-published-date").text().trim();
    const placesToRead: PlaceToRead[] = [];
    $(element)
      .find(".source-items > abbr")
      .each((_, abbr) => {
        const siteTitle = $(abbr).attr("title");
        const logo = $(abbr).find("img").attr("src");
        const url = $(abbr)
          .find("a")
          .attr("href")
          ?.replace(c.env.REDIRECT_URL || "", "");
        placesToRead.push({ siteTitle, logo, url });
      });

    newsData.push({
      image,
      imageSource,
      publishedTime,
      title,
      description,
      placesToRead,
    });
  });

  return newsData;
}

// Create a Hono app
const app = new Hono<{ Bindings: Bindings }>();

app.get("/news", async (c, env) => {
  const url = c.env.NEWS_URL;
  if (!url) {
    return c.json({ error: "NEWS_URL is not set." }, 400);
  }

  const news = await extractNewsData(url, c);
  if (!news) {
    return c.json({ error: "Failed to fetch news data." }, 500);
  }

  return c.json(news);
});

app.get("/", (c) => {
  return c.json(
    {
      name: "News API Worker",
      description:
        "A Cloudflare Worker-based API that scrapes and provides structured news data from a red app.",
      author: {
        name: "Sandip Sapkota",
        website: "https://sandipsapkota.com",
        github: "https://github.com/dev-sandip",
      },
      endpoints: {
        news: {
          method: "GET",
          path: "/news",
          description: "Fetches and returns structured news articles.",
          example: "/news",
        },
      },
      version: "1.0.0",
      license: "MIT",
    },
    200
  );
});

export default app;
