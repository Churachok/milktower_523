import React from "react";
import { personalizedNews } from "../domain/news";
import { Button, Icon, PageHeading } from "../components/ui";

export function NewsFeed({ applications, navigate, compact = false }) {
  const articles = personalizedNews(applications).slice(0, compact ? 2 : 5);
  return (
    <section className={compact ? "news-section" : "news-page"} aria-label="Персональная новостная лента">
      {compact && <div className="section-heading"><h2>Для вашего бизнеса</h2><button className="text-button" onClick={() => navigate("/news")}>Все материалы <Icon name="arrow" size={16} /></button></div>}
      <div className="news-grid">
        {articles.map((article) => <article className="card news-card" key={article.id}>
          <span className="eyebrow">{article.category}</span>
          <h3>{article.title}</h3><p>{article.summary}</p>
          <p className="news-reason"><Icon name="info" size={15} />{article.reason}</p>
          {compact ? <button className="text-button" onClick={() => navigate("/news")}>Читать материал <Icon name="arrow" size={15} /></button> : <>
            <details><summary>Читать полностью</summary>{article.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</details>
            <Button variant="secondary" onClick={() => navigate(article.route)}>{article.action}</Button>
          </>}
        </article>)}
      </div>
      <p className="legal-note">Редакция Milk Tower · демонстрационные материалы. Подбор зависит от ваших заявок, сферы деятельности и финансовых данных. Внешние новостные сервисы не используются.</p>
    </section>
  );
}
export default function News(props) {
  return <><PageHeading title="Для вашего бизнеса" description="Новости кабинета и полезные материалы с учётом вашей ситуации." /><NewsFeed {...props} /></>;
}
