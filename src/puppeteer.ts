import puppeteer, { Browser, ElementHandle, Page } from "puppeteer";
import { filter, find, forEach, map } from "async";

import {
  albumCoverSelector,
  albumInfoSelector,
  albumStatsSelector,
  artistRegex,
  formatReleaseDate,
  getClassList,
  subTitleSelector,
  titleSelector,
  trackItemSelector,
  trackTableSelector,
} from "@/utils";
import { DiscResponse, TableHandle, VGMDBResponse } from "@/types";

let browser: Browser;

const getText = (element: ElementHandle<Element> | null) =>
  element?.evaluate((el) => el.textContent?.trim());

async function getTextFromSelector(page: Page, selector: string) {
  const element = await page.waitForSelector(selector);
  const text = await getText(element);
  return text;
}

async function getAlbumInfo(page: Page) {
  const infoTable = await page.$(albumInfoSelector);
  if (!infoTable) return {};

  const rows = await infoTable.$$("tbody tr");
  const entries = await map(
    rows,
    async (row: ElementHandle<HTMLTableRowElement>) => {
      const tdList = await row.$$("td");
      const [label, value] = await map(
        tdList,
        async (el: ElementHandle<HTMLTableCellElement>) => getText(el)
      );

      return [label, value];
    }
  );

  const result = Object.fromEntries(entries);
  result.releaseDate = formatReleaseDate(result["Release Date"]);
  result.classifications = getClassList(result["Classification"]);

  delete result["Release Date"];
  delete result["Classification"];

  return result;
}

async function getTrackList(page: Page): Promise<DiscResponse[]> {
  const allTrackTables = await page.$$(trackTableSelector);
  const trackTables = await filter(allTrackTables, async (tableHandler) => {
    const parentHandler = (
      await tableHandler.getProperty("parentNode")
    ).asElement();

    const display = await parentHandler?.evaluate(async (parentElement) => {
      return await new Promise((resolve) => {
        //@ts-expect-error
        resolve(getComputedStyle(parentElement)["display"]);
      });
    });

    return display !== "none";
  });

  let discIndex = -1;
  const discs: DiscResponse[] = await map(
    trackTables,
    async (trackTable: TableHandle) => {
      const rows = await trackTable.$$("tbody tr");
      const allTracks = await map(
        rows,
        async (row: ElementHandle<HTMLTableRowElement>) => {
          const td = await row.$("td:nth-child(2)");
          return await td?.evaluate((el) => el.textContent?.trim());
        }
      );
      const tracks = allTracks.filter((t) => t) as string[];

      discIndex++;
      return { number: discIndex, tracks };
    }
  );

  return discs;
}

async function getArtists(page: Page): Promise<string[]> {
  const rows = await page.$$(trackItemSelector);
  const artists = new Set<string>();

  await forEach(rows, async (row) => {
    const [labelElement, valuesElement] = await row.$$("td");
    const label = await getText(labelElement);

    if (!label || !artistRegex.test(label)) return;

    const values = await getText(valuesElement);
    values?.split(",").forEach((v) => {
      const [name] = v.split("/");
      artists.add(name.trim());
    });
  });

  return Array.from(artists);
}

async function getCategories(page: Page): Promise<string[]> {
  const labels = await page.$$(albumStatsSelector);
  const label = await find(labels, async (l) => {
    const text = await getText(l);
    return /^(category)+/i.test(text ?? "");
  });

  const parent = await label?.getProperty("parentNode");
  // @ts-expect-error
  const text = await getText(parent);

  return text ? text.split("\n").filter((c) => !/^(category)+/i.test(c)) : [];
}

async function getCoverUrl(page: Page) {
  const coverElement = await page.$(albumCoverSelector);
  const coverStyle = await coverElement?.evaluate((el) =>
    el.getAttribute("style")
  );
  const coverUrl =
    coverStyle
      ?.replace("background-image: url('", "")
      .replaceAll(/[('"())]/g, "") ?? null;

  return coverUrl;
}

export default async function getPuppeteer(
  url: string
): Promise<VGMDBResponse | null> {
  try {
    if (!browser) browser = await puppeteer.launch();

    const page = await browser.newPage();
    await page.goto(url);

    const [title, subTitle, info, trackList, artists, categories, coverUrl] =
      await Promise.all([
        await getTextFromSelector(page, titleSelector),
        await getTextFromSelector(page, subTitleSelector),
        await getAlbumInfo(page),
        await getTrackList(page),
        await getArtists(page),
        await getCategories(page),
        await getCoverUrl(page),
      ]);

    return {
      ...info,
      title,
      subTitle,
      trackList,
      artists,
      categories,
      coverUrl,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
