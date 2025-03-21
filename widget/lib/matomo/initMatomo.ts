export const initMatomo = () => {
  if (window._paq) {
    return;
  }
  // Create the _paq array if it doesn't exist
  window._paq = window._paq || [];

  // Push tracking commands
  window._paq.push(["trackPageView"]);
  window._paq.push(["enableLinkTracking"]);

  // Set up the tracker
  const u = "https://stats.beta.gouv.fr/";
  window._paq.push(["setTrackerUrl", u + "matomo.php"]);
  window._paq.push(["setSiteId", "201"]);

  // Create and append the script
  const script = document.createElement("script");
  script.async = true;
  script.src = u + "matomo.js";

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
};
