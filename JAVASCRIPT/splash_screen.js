window.addEventListener("load", function () {
  setTimeout(function () {
    const splashScreen = document.getElementById("splashScreen");

    splashScreen.style.opacity = "0";

    setTimeout(function () {
      window.location.href = "../HTML/index.html";
    }, 800);
  }, 2500);
});
