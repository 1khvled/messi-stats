/* Centralized Revenue & CPA Registry — MessiStat Monetization Config
   Single source of truth for all ad network IDs, affiliate tags, and
   high-CPA offer URLs. Swap any URL to an Impact.com tracking link in
   one line without touching app.js.
   -----------------------------------------------------------------------
   Override mlsStreamPassUrl at runtime by setting window.__MS_STREAM_CPA_URL
   before this module is imported.                                        */

export const MONETIZE_CONFIG = {
  /* Google AdSense publisher ID */
  adsenseClient: "ca-pub-8397501846754760",

  /* Adsterra primary Smartlink — also used as fallback for all CPA CTAs */
  adsterraSmartlinkUrl: "https://araplhn.org/4/9c0421236e838b103398fe1f230fd98e",

  /* Adsterra Social Bar external script URL.
     If non-empty, app.js mounts <iframe src="/ads/social-bar.html?src=..." ...>
     automatically; leave empty to use the built-in in-page push instead. */
  adsterraSocialBarScriptUrl: "",

  /* Amazon Associates tag */
  amazonAffiliateTag: "messistat-20",

  /* High-CPA offer URLs — ready for 1-line Impact.com deep-link swaps */
  offers: {
    /** MLS / Argentina live stream pass — override at runtime with
     *  window.__MS_STREAM_CPA_URL before the module loads.           */
    get mlsStreamPassUrl() {
      return (typeof window !== "undefined" && window.__MS_STREAM_CPA_URL) ||
        "https://araplhn.org/4/9c0421236e838b103398fe1f230fd98e";
    },

    /** VPN streaming offer for geo-blocked matches */
    vpnStreamUrl: "https://araplhn.org/4/9c0421236e838b103398fe1f230fd98e",

    /** Inter Miami official kit (Amazon affiliate) */
    kitMiamiUrl:
      "https://www.amazon.com/s?k=inter+miami+messi+jersey+10&tag=messistat-20",

    /** Argentina 3-star World Cup kit (Amazon affiliate) */
    kitArgentinaUrl:
      "https://www.amazon.com/s?k=argentina+messi+3+star+jersey+10&tag=messistat-20",

    /** Classic Barcelona #10 jersey + Adidas F50 boots (Amazon affiliate) */
    kitBarcaBootsUrl:
      "https://www.amazon.com/s?k=lionel+messi+barcelona+10+jersey+adidas+f50&tag=messistat-20"
  }
};
