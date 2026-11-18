/**
 * Goodreads' markup, rebuilt for tests from pages fetched on 2026-11-18:
 * the widget's escaped JavaScript string, the progress list and the tooltip
 * keep the shape of the real ones.
 */

export interface MarkupBook {
	reviewId: string;
	bookId: string;
	title: string;
	author: string;
	stars?: number;
	/** A book with no cover has Goodreads' placeholder */
	noCover?: boolean;
}

function escapeScript(html: string): string {
	return html
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/'/g, "\\'")
		.replace(/<\//g, "<\\/")
		.replace(/\n/g, "\\n");
}

function star(active: boolean): string {
	return `<img style="width:15px;height:15px" alt="" src="https://s.gr-assets.com/images/layout/gr_flat_red_star_${active ? "active" : "inactive"}.png" />`;
}

/** The answer of `/review/custom_widget/<id>` for a shelf. */
export function widgetScript(shelf: string, books: MarkupBook[]): string {
	const id = "5101";
	const entries = books
		.map((book) => {
			const link = `https://www.goodreads.com/review/show/${book.reviewId}?utm_medium=api&amp;utm_source=custom_widget`;
			const image = book.noCover
				? "https://s.gr-assets.com/assets/nophoto/book/50x75-a91bf249278a81aabab721ef782c4a74.png"
				: `https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1408816275l/${book.bookId}._SY75_.jpg`;
			const stars = [1, 2, 3, 4, 5]
				.map((nth) => star(nth <= (book.stars ?? 0)))
				.join("");
			return `      <div class="gr_custom_each_container_${id}">
          <div class="gr_custom_book_container_${id}">
            <a title="${book.title}" rel="nofollow" href="${link}"><img alt="${book.title}" border="0" src="${image}" /></a>
          </div>
          <div class="gr_custom_rating_${id}">
            <span class=" staticStars notranslate">${stars}</span>
          </div>
          <div class="gr_custom_title_${id}">
            <a rel="nofollow" href="${link}">${book.title}</a>
          </div>
          <div class="gr_custom_author_${id}">
            by <a rel="nofollow" href="https://www.goodreads.com/author/show/2520656.An_Author">${book.author}</a>
          </div>
      </div>
`;
		})
		.join("");
	const html = `  <div class="gr_custom_container_${id}">
    <h2 class="gr_custom_header_${id}">
    <a style="text-decoration: none;" rel="nofollow" href="https://www.goodreads.com/review/list/1-a-reader?shelf=${shelf}&amp;utm_medium=api&amp;utm_source=custom_widget">A Reader&#39;s books</a>
    </h2>
${entries}  <br style="clear: both"/>
  </div>
`;
	return `  var widget_code = '${escapeScript(html)}'
  var widget_div = document.getElementById('gr_custom_widget_${id}')
  if (widget_div) {
    widget_div.innerHTML = widget_code
  }
`;
}

export interface MarkupUpdate {
	bookId: string;
	/** "is on page 137 of 248 of", "is 81% done with", "is starting" */
	says: string;
	/** "Jun 02, 2026 07:27AM" */
	when: string;
}

/** The page at `/user_status/list/<id>`. */
export function progressPage(updates: MarkupUpdate[]): string {
	const entries = updates
		.map(
			(update, index) => `      <div class="elementList">
        <div id="user_status_${1277808570 - index}">
  <div class="left" style="float: left; width: 495px;">
    <span class="uitext greyText inlineblock stacked user_status_header">
      <a href="/user/show/1-a-reader">A Reader</a>
      ${update.says} <a href="https://www.goodreads.com/book/show/${update.bookId}-a-book" rel="nofollow noopener">A Book</a>
    </span>
    <div class="readable body">
    </div>
    <span class="greyText uitext smallText">
      &mdash; <a class="greyText" href="/user_status/show/${1277808570 - index}">${update.when}</a>
    </span>
  </div>
</div>
      </div>
`,
		)
		.join("");
	return `<div class="leftContainer">
  <h1><a href="/user/show/1-a-reader">A Reader</a> &gt; Recent Status Updates</h1>
${entries}
      <div class="elementList">
        <div id="user_status_936574799">
    <span class="uitext greyText inlineblock stacked user_status_header">
      <a href="/user/show/1-a-reader">A Reader</a>
      added a status update
    </span>
    <span class="greyText uitext smallText">
      &mdash; <a class="greyText" href="/user_status/show/936574799">Oct 25, 2024 01:12PM</a>
    </span>
</div>
      </div>
</div>`;
}

/** The answer of `/tooltips` for one book. */
export function tooltipJson(
	bookId: string,
	details: { averageRating: string; description: string },
): string {
	return JSON.stringify({
		tooltips: {
			[`Book.${bookId}`]: `<section class='tooltip js-tooltip'>
<h2><a class="readable" href="/book/show/${bookId}-a-book">A Book</a></h2>
<div class='bookRatingAndPublishing'>
<span class="minirating"><span class="stars staticStars notranslate"><span size="12x12" class="staticStar p10"></span></span> ${details.averageRating} avg rating &mdash; 11,069 ratings</span>
</div>
<div class='addBookTipDescription'>
<span id="freeTextContainer9220751152544241077">${details.description.slice(0, 40)}</span>
  <span id="freeText9220751152544241077" style="display:none">${details.description}</span>
  <a data-text-id="9220751152544241077" href="#">...more</a>
</div>
</section>
`,
		},
	});
}
