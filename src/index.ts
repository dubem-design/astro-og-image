import * as fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import type { AstroIntegration, RouteData } from "astro";
import glob from "glob";

type pagePath = {
  pathName: string;
};
type patternsType = {
  pattern: RegExp;
};

export default function astroOGImage({
  config,
}: {
  config: { path: string; patterns: patternsType[] };
}): AstroIntegration {
  return {
    name: "astro-og-image",
    hooks: {
      "astro:build:done": async ({ dir, routes }) => {
        printRoutePatterns(routes);
        let path = config.path;
        let patterns = config.patterns;
        let filteredRoutes = routes.filter((route: RouteData) =>
          route?.component?.includes(path)
        );

        const filteredPatternedRoutes = glob.sync(
          dir.pathname + "**/*.html",
          {}
        );
        const res = filteredPatternedRoutes
          .filter((x: string, index: number) => {
            return patterns.find((y) => {
              const noSystemDir = x.replace(/.*(?=dist)/i, "");
              const noDist = noSystemDir.replace(/dist/i, "");
              const noIndexHtml = noDist.replace(/index.html/i, "");
              return new RegExp(y.pattern).test(noIndexHtml);
            });
          })
          .map((x) => ({ pathname: x }));

        await generateOgImage(
          patterns ? res : filteredPatternedRoutes,
          path,
          dir
        );
      },
    },
  };
}

async function generateOgImage(
  filteredRoutes: RouteData[],
  path: string,
  dir: any
) {
  // Creates a directory for the images if it doesn't exist already
  let directory = fileURLToPath(new URL(`./assets/${path}`, dir));
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  for (const route of filteredRoutes) {
    // Gets the title
    const pathname = route?.pathname;
    // console.log("pathname", pathname);

    // Skip URLs that have not been built (draft: true, etc.)
    if (!pathname) continue;

    const data = fs.readFileSync(pathname as any, "utf-8") as any;
    let title = await data.match(/<title[^>]*>([^<]+)<\/title>/)[1];

    // Get the html
    const html = fs
      .readFileSync("og-image.html", "utf-8")
      .toString()
      .replace("@title", title);

    const page = await browser.newPage();
    await page.setContent(html);
    await page.waitForNetworkIdle();
    await page.setViewport({
      width: 1200,
      height: 630,
    });

    await page.screenshot({
      path: fileURLToPath(
        new URL(`./assets/${pathname.split("/").at(-2)}.png`, dir)
      ),
      encoding: "binary",
    });
  }
  await browser.close();
}

function printRoutePatterns(routes: RouteData[]) {
  console.log("From astro-og-image: ======================");
  console.log("Routes Patterns to copy: ======================");
  routes.forEach((x) => {
    console.log("template/page: ", x.route);
    console.log("pattern: ", x.pattern);
    console.log(" ");
  });
}
