addEventListener('fetch', event => {
  event.respondWith(new Promise((resolve, reject) => {
    //get the url of the request
    let url = new URL(event.request.url);

    //the '/' route, that we are A/B "testing"
    if (url.pathname === '/') {
      let cookie = getCookie(event.request, "url");
      //if the request has the url as a cookie, don't bother fetching variants
      if (cookie) {
        return resolve(handleABRequest(event.request, cookie));//note we return here, so we don't fetch the variants
      }

      //get our variants
      fetch('https://cfw-takehome.developers.workers.dev/api/variants')
      .then(res => res.json())
      .then(res => {
        //get a random variant and call the handler
        let variantUrl = res.variants[Math.floor(Math.random()*res.variants.length)];
        resolve(handleABRequest(event.request, variantUrl));
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
    }
    //all other requests
    else {
      handleDefaultRequest(event.request);
    }
   }));
});

/**
 * Respond with hello worker text
 * Note: I left this blank to respond to other requests (e.g. favicon)
 * @param {Request} request
 */
async function handleDefaultRequest(request) {
  return new Response('Hello worker!', {
    headers: { 'content-type': 'text/plain' }
  });
}

/**
 * Fetch the html at '/' and modify it
 * @param {Request} request
 * @param {String} url
 */
async function handleABRequest(request, url) {

  return new Promise((resolve, reject) => {
    fetch(url)
    .then(res => {
      //transform html using an inline function and 'NumberHandler'
      let transformedRes = new HTMLRewriter()
        .on('a#url', {element: (element) => {
          element.setAttribute('href', "https://battlefields.io");
          element.setInnerContent("My latest game! It uses Cloudflare's reverse proxy :)")
        }})
        .on('title, h1#title, p#description', new NumberHandler())
        .transform(res);

      //add a cookie saying which url they should get
      transformedRes.headers.set("Set-Cookie", "url="+url);

      //resolve with our modified website
      resolve(transformedRes);
    })
    .catch(err => {
      console.log(err);
      reject(err);
    });
  });
}

/**
 * Grabs the cookie with name from the request headers
 * credit: https://developers.cloudflare.com/workers/templates/pages/cookie_extract/
 * @param {Request} request incoming Request
 * @param {string} name of the cookie to grab
 */
function getCookie(request, name) {
  let result = null
  let cookieString = request.headers.get('Cookie')
  if (cookieString) {
    let cookies = cookieString.split(';')
    cookies.forEach(cookie => {
      let cookieName = cookie.split('=')[0].trim()
      if (cookieName === name) {
        let cookieVal = cookie.split('=')[1]
        result = cookieVal
      }
    })
  }
  return result
}

/**
 * Replaces 1, 2, 'one', and 'two' with written-out spanish equivalents
 */
class NumberHandler {
  text(text) {
    if (text.text.indexOf('1') !== -1) text.replace(text.text.replace("1", "uno"));
    if (text.text.indexOf('one') !== -1) text.replace(text.text.replace("one", "uno"));
    if (text.text.indexOf('2') !== -1) text.replace(text.text.replace("2", "dos"));
    if (text.text.indexOf('two') !== -1) text.replace(text.text.replace("two", "dos"));
  }
}