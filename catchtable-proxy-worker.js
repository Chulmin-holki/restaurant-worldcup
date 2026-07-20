/**
 * 선택 사항: 캐치테이블 페이지가 브라우저의 직접 읽기를 막는 경우 사용하는
 * Cloudflare Worker 예시입니다. 허용된 캐치테이블 투표 페이지만 전달합니다.
 */
export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return json({ error: "GET 요청만 사용할 수 있습니다." }, 405, corsHeaders);
    }

    const requestUrl = new URL(request.url);
    const targetValue = requestUrl.searchParams.get("url");
    if (!targetValue) {
      return json({ error: "url 파라미터가 없습니다." }, 400, corsHeaders);
    }

    let target;
    try {
      target = new URL(targetValue);
    } catch {
      return json({ error: "올바른 URL이 아닙니다." }, 400, corsHeaders);
    }

    const isCatchtableHost =
      target.hostname === "catchtable.co.kr" ||
      target.hostname.endsWith(".catchtable.co.kr") ||
      target.hostname === "catchtable.page.link" ||
      target.hostname === "catchtable.onelink.me";
    if (target.protocol !== "https:" || !isCatchtableHost) {
      return json({ error: "캐치테이블 공유 링크만 허용됩니다." }, 403, corsHeaders);
    }

    try {
      const response = await fetch(target.toString(), {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/json",
          "User-Agent": "Mozilla/5.0 FoodWorldcupImporter/1.0",
        },
        cf: { cacheTtl: 300, cacheEverything: true },
      });

      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": response.headers.get("Content-Type") || "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return json({ error: "캐치테이블 페이지를 가져오지 못했습니다." }, 502, corsHeaders);
    }
  },
};

function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
