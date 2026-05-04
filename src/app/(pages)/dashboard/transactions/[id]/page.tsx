"use client";

import CashflowForm from "@/components/reports/cashflow";

type TransactionsEditPageProps = {
  params: {
    id: string;
  };
};

export default function TransactionsEditPage({ params }: TransactionsEditPageProps) {
  return <CashflowForm transactionId={params.id} />;
}
