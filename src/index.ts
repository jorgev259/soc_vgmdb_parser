import getPuppeteer from "./clients/puppeteer";
import getCheerio from "./clients/cheerio";
import { isBrowser } from "./utils";

export default function getVGMDB(url: string) {
  try {
    const clientFn = isBrowser ? getCheerio : getPuppeteer;
    return clientFn(url);
  } catch (err) {
    console.error(err);
    return null;
  }
}
