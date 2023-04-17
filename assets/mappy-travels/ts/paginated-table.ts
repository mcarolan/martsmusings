const PAGE_SIZE = 5;
const PAGES_AROUND = 4;

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

function continuesElement(): HTMLElement {
    const result = document.createElement("span");
    result.innerText = '...';
    return result;
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