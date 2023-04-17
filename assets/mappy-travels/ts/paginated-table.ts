const PAGE_SIZE = 5;

var rows: NodeListOf<HTMLElement> | undefined;
var pagerElement: HTMLElement | undefined;
var numberOfPages: number | undefined;
var currentPage: number = 1;

function showFirstPage() {
    const rows = document.querySelectorAll("#paginated-table tr");
    for (var i = 0; i < Math.min(rows.length, PAGE_SIZE); ++i) {
        const row = rows.item(i);
        row.classList.remove("row-hidden");
    }
}

function pageElement(i: number): HTMLElement {
    const el = document.createElement("div");
    if (i == currentPage) {
        el.classList.add("current-page");
    }
    var content: HTMLElement;
    if (i == currentPage) {
        content = document.createElement("span");
    }
    else {
        content = document.createElement("a");
        content.setAttribute("href", `javascript:window.showPage(${i})`);
    }

    content.innerText = i.toString();
    el.appendChild(content);
    return el;
}

function showPage(pageNumber: number) {
    //hide previous page rows
    const previousPageStart = (currentPage - 1) * PAGE_SIZE;
    for (var i = previousPageStart; i < Math.min(rows.length, previousPageStart + PAGE_SIZE); ++i) {
        const row = rows.item(i);
        row.classList.add("row-hidden");
    }

    currentPage = pageNumber;
    showPager();

    //show desired page rows
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    for (var i = pageStart; i < Math.min(rows.length, pageStart + PAGE_SIZE); ++i) {
        const row = rows.item(i);
        row.classList.remove("row-hidden");
    }
}

window.showPage = showPage;

function showPager() {
    const newChildren: Node[] = []
    for (var i = 0; i < numberOfPages; ++i) {
        const page = pageElement(i + 1);
        newChildren.push(page);
    }
    pagerElement.replaceChildren(...newChildren);
}

document.addEventListener("DOMContentLoaded", () => {
    rows = document.querySelectorAll("#paginated-table-body tr");
    pagerElement = document.getElementById("paginated-table-pager");
    numberOfPages = Math.ceil(rows.length / PAGE_SIZE);
    showPage(numberOfPages);
});