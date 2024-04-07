import axios from "axios";
import { load, CheerioAPI, text } from "cheerio";

import { DiscResponse } from "@/types";
import {
  albumCoverSelector,
  albumInfoSelector,
  albumStatsSelector,
  artistRegex,
  formatReleaseDate,
  getClassList,
  subTitleSelector,
  titleSelector,
  trackTableSelector,
} from "@/utils";

function getTableInfo($: CheerioAPI) {
  const table = $(albumInfoSelector)[0];
  if (!table) return {};

  const { children: tableChildren } = table;
  // @ts-expect-error
  const tableBody = tableChildren.find((c) => c.name === "tbody");
  if (!tableBody) return {};

  // @ts-expect-error
  const rows = tableBody.children.filter(
    // @ts-expect-error
    (c) => c.type === "tag" && c.name === "tr"
  );

  const result: { [key: string]: any } = {};

  // @ts-expect-error
  rows.forEach((row) => {
    const { children } = row;
    // @ts-expect-error
    const [labelEl, valueEl] = children.filter((c) => c.name === "td");

    if (!labelEl) return;
    result[text(labelEl.children)] = valueEl ? text(valueEl.children) : "";
  });

  result.releaseDate = formatReleaseDate(result["Release Date"]);
  result.classifications = getClassList(result["Classification"]);

  delete result["Release Date"];
  delete result["Classification"];

  return result;
}

function traverse<T>(childrenList: ChildNode[], result: Set<T>) {
  if (childrenList.length === 0) return result;

  childrenList.forEach((c) => {
    // @ts-expect-error
    if (c.type === "text") {
      // @ts-expect-error
      const parent = c.parent;
      if (!parent.attribs?.style?.includes("display:none")) {
        // @ts-expect-error
        const text = c.data.trim();
        if (text.length > 1) result.add(text.replaceAll(",", "").trim());
      }
      // @ts-expect-error
    } else traverse(c.children, result);
  });

  return result;
}

function getTracklist($: CheerioAPI) {
  const trackList: DiscResponse[] = [];

  try {
    const discs = $(trackTableSelector);
    discs.each((i, d) => {
      const parent = d?.parent;
      // @ts-expect-error
      if (!parent || parent.attribs.style?.includes("display: none")) return;

      const list: string[] = [];
      const tbody = d.childNodes.find((n) => n.type === "tag");
      if (!tbody) return;

      // @ts-expect-error
      const trows = tbody.childNodes.filter(
        // @ts-expect-error
        (n) => n.type === "tag" && n.name === "tr"
      );

      // @ts-expect-error
      trows.forEach((tRow, i2) => {
        const tds = tRow.childNodes.filter(
          // @ts-expect-error
          (n) => n.type === "tag" && n.name === "td"
        );
        // @ts-ignore
        const td = tds[1].childNodes[0].data.trim();

        list.push(td);
      });
      trackList.push({ number: i, tracks: list });
    });

    return trackList;
  } catch (err) {
    console.error(err);
  }

  return trackList;
}

function getArtists($: CheerioAPI) {
  const artists = new Set();

  try {
    $('.maincred .artistname[style*="display:inline"]').each((_, labelEl) => {
      const labelText = (text(labelEl.children) ?? "").toLowerCase().trim();
      if (!artistRegex.test(labelText)) return;

      let parentEl = labelEl.parent;
      // @ts-expect-error
      while (parentEl && !parentEl.attribs?.class?.includes("maincred")) {
        parentEl = parentEl.parent;
      }
      if (!parentEl) return;

      const dataEl = parentEl.children[1];
      // @ts-expect-error
      traverse(dataEl.children, artists);
    });
  } catch (err) {
    console.error(err);
  }

  return Array.from(artists);
}

function getCategories($: CheerioAPI) {
  const result: string[] = [];

  try {
    const labels = $(albumStatsSelector);
    labels.each((_, l) => {
      const labelText = text(l.children).toLowerCase().trim();
      if (labelText === "category") {
        const resultText = text(
          l.parent?.children.filter((c) => c.type === "text")
        ).trim();
        result.push(resultText);

        return false;
      }
    });
  } catch (err) {
    console.error(err);
  }

  return result;
}

export default async function getCheerio(url: string) {
  const { data } = await axios.get(url, {
    headers: { "Content-Type": "text/html" },
  });
  const $ = load(data);

  const title = $(titleSelector).text();
  const subTitle = $(subTitleSelector).text();

  const info = getTableInfo($);

  const tracklist = getTracklist($);
  const artists = getArtists($);
  const categories = getCategories($);
  const coverUrl =
    $(albumCoverSelector)[0]
      .attribs.style.replace("background-image: url('", "")
      .replaceAll(/[('"())]/g, "") ?? null;

  const album = {
    ...info,
    title,
    subTitle,
    tracklist,
    artists,
    categories,
    coverUrl,
  };

  return album;
}
