(() => {
  // <stdin>
  var PAGE_SIZE = 5;
  var PAGES_AROUND = 4;
  var rows;
  var pagerElement;
  var numberOfPages;
  var currentPage = 1;
  function pageElement(i) {
    const el = document.createElement("div");
    if (i == currentPage) {
      el.classList.add("current-page");
    }
    var content;
    if (i == currentPage) {
      content = document.createElement("span");
    } else {
      content = document.createElement("a");
      content.setAttribute("href", `javascript:window.showPage(${i})`);
    }
    content.innerText = i.toString();
    el.appendChild(content);
    return el;
  }
  function continuesElement() {
    const result = document.createElement("span");
    result.innerText = "...";
    return result;
  }
  function showPage(pageNumber) {
    const previousPageStart = (currentPage - 1) * PAGE_SIZE;
    for (var i = previousPageStart; i < Math.min(rows.length, previousPageStart + PAGE_SIZE); ++i) {
      const row = rows.item(i);
      row.classList.add("row-hidden");
    }
    currentPage = pageNumber;
    showPager();
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    for (var i = pageStart; i < Math.min(rows.length, pageStart + PAGE_SIZE); ++i) {
      const row = rows.item(i);
      row.classList.remove("row-hidden");
    }
  }
  window.showPage = showPage;
  function showPager() {
    const newChildren = [];
    if (currentPage - 1 >= PAGES_AROUND) {
      const firstPage = pageElement(1);
      newChildren.push(firstPage);
      if (currentPage - 1 > PAGES_AROUND) {
        newChildren.push(continuesElement());
      }
    }
    for (var i = Math.max(0, currentPage - PAGES_AROUND); i < Math.min(numberOfPages, currentPage + PAGES_AROUND); ++i) {
      const page = pageElement(i + 1);
      newChildren.push(page);
    }
    if (numberOfPages - currentPage >= PAGES_AROUND + 1) {
      const lastPage = pageElement(numberOfPages);
      if (numberOfPages - currentPage > PAGES_AROUND + 1) {
        newChildren.push(continuesElement());
      }
      newChildren.push(lastPage);
    }
    pagerElement.replaceChildren(...newChildren);
    if (numberOfPages == 1) {
      pagerElement.classList.add("display-none");
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    rows = document.querySelectorAll("#paginated-table-body tr");
    pagerElement = document.getElementById("paginated-table-pager");
    numberOfPages = Math.ceil(rows.length / PAGE_SIZE);
    showPage(numberOfPages);
  });
})();
