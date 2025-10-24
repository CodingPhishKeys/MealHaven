window.addEventListener("load", function () {
  setTimeout(function () {
    const splashScreen = document.getElementById("splashScreen");

    splashScreen.style.opacity = "0";

    setTimeout(function () {
      splashScreen.style.display = "none";
    }, 800);
  }, 2500);
});
