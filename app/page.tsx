import type { Metadata } from "next";
import { CrmApp } from "./crm/CrmApp";

export const metadata: Metadata = {
  title: "ГОФРА CRM — frontend prototype",
  description:
    "Канбан клиентов и сделок, контакты, история, импорт и справочники в одном frontend-only CRM-прототипе.",
};

export default function Home() {
  return <CrmApp />;
}
