// Dashboard menu (mobile sidebar toggle).
const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");

if (menuButton && sidebar) {
    menuButton.addEventListener("click", function () {
        sidebar.classList.toggle("open");
    });

    document.querySelectorAll(".nav-link").forEach(function (link) {
        link.addEventListener("click", function () {
            sidebar.classList.remove("open");

            document.querySelectorAll(".nav-link").forEach(function (item) {
                item.classList.remove("active");
            });

            link.classList.add("active");
        });
    });
}
