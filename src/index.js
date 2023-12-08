import { load } from 'cheerio'


export async function loadData() {
	const html = await fetch('https://xhh.club').then(res => res.text())
	const $ = load(html)
	const articles = [];

	$('article').each((index, element) => {
		const title = $(element).find('h1').text().trim()
		let summary = $(element).find('.tab-pane.active').text().trim()
		if (summary.includes('AI生成摘要')) {
			summary = summary.replace('AI生成摘要', '').trim()
		} else {
			summary = title
		}
		const article = {
			title,
			summary,
			link: decodeURIComponent(decodeURIComponent($(element).find('a').attr('href').split('/')[4])),
			publishedTime: $(element).find('span[data-function="fromNow"]').text().trim(),
		};
		articles.push(article);
	});
	return articles;

}

export default {
	async scheduled(event, env, ctx) {
		const { DB, TELEGRAM_ID, TELEGRAM_TOKEN } = env
		const result = await loadData();
		const lastArticles = await DB.get('lastArticles').then(res => res || '[]').then(JSON.parse)
		for (const newArticle of result) {
			try {
				if (lastArticles.includes(newArticle.link)) {
					continue
				}
				lastArticles.push(newArticle.link)
				const message = `${newArticle.summary}\n\n${newArticle.link}`
				await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json;charset=UTF-8',
					},
					body: JSON.stringify({
						chat_id: TELEGRAM_ID,
						text: message,
						disable_web_page_preview: false,
					}),
				})
			} catch (e) {
				console.log(e)
			}
		}
		if (lastArticles.length > 50) {
			lastArticles.splice(0, lastArticles.length - 50)
		}
		await DB.put('lastArticles', JSON.stringify(lastArticles))
	},
	async fetch(request, env, ctx) {
		const result = await loadData();
		return new Response(JSON.stringify(result, null, 2), {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		});
	},
};
