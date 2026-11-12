"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import { FiBookOpen, FiChevronDown, FiHelpCircle, FiLogOut } from "react-icons/fi";

type Tutorial = {
  title: string;
  description: string;
  steps: { title: string; details: string; items?: string[] }[];
};

const signIn: Tutorial = {
  title: "Signing In",
  description: "Use your assigned BrewTrack account to access the system.",
  steps: [
    { title: "Open BrewTrack", details: "Launch BrewTrack using the provided website or application link." },
    { title: "Enter your credentials", details: "Type your assigned username and password into the login fields." },
    { title: "Log in", details: "Click Log In to access the system." },
  ],
};

const tutorials: Tutorial[] = [
  {
    title: "Admin Guide",
    description: "Manage the menu, ingredients, staff accounts, and business records.",
    steps: [
      { title: "Manage products and categories", details: "Open Products from the sidebar. Use Add Category to create a category, then use Add Product to create a menu item. Review the details and save the product. Use Edit or Delete to maintain existing products." },
      { title: "Manage ingredients and add-ons", details: "Open Ingredients from the sidebar. Click Add Ingredient and enter the ingredient information. Use Add Add-On to create an optional item customers can add to orders." },
      { title: "View reports", details: "Open Reports and choose the reporting period you need: Daily, Weekly, Monthly, or Yearly. Select the appropriate date or period to review sales and inventory." },
      { title: "Manage transactions", details: "Open Transactions and choose Pay In for money received or Pay Out for money spent. Enter the category, description, amount, date, and optional reference or notes. Review the details and click Record Transaction." },
      { title: "Manage users", details: "Open Settings and click Add New User. Enter the username, first name, last name, role, and password. Click Add User, then use Edit, password, or Delete to maintain accounts." },
    ],
  },
  {
    title: "Cashier Guide",
    description: "Handle customer orders, checkout, incoming orders, and order history.",
    steps: [
      { title: "Create a customer order", details: "Open the Menu, select a product and variant, add optional add-ons, and review the cart. Choose Dine-in or Takeout, enter the customer name, add special requests, check the total, enter the payment amount if applicable, and click Checkout." },
      { title: "Accept incoming orders", details: "Click View Queue on the cashier screen. Review the customer, items, quantities, and notes. Verify the details, then click Accept to Kitchen." },
      { title: "Find, edit, or delete an order", details: "Open History and search by order number or customer name. Select the order, choose Edit or Delete, enter an admin password when prompted, and verify the result." },
    ],
  },
  {
    title: "Kitchen Staff Guide",
    description: "Prepare accepted orders and mark them complete.",
    steps: [
      { title: "Open the Kitchen screen", details: "Review the orders displayed in Preparing now." },
      { title: "Select an order", details: "Open the order and check the order number, customer name, items, quantities, variants, and special requests." },
      { title: "Prepare the order", details: "Prepare the food or beverages according to the displayed order details and special requests." },
      { title: "Mark the order as done", details: "Once the order is ready, click Mark done." },
      { title: "Verify completion", details: "Check that the order appears in the completed-orders area." },
    ],
  },
  {
    title: "Tablet Ordering Guide",
    description: "Create an order from the tablet through the cashier area.",
    steps: [
      { title: "Open the cashier area", details: "Sign in using a cashier account and locate the Mobile Order button on the cashier screen." },
      { title: "Open Tablet Ordering", details: "Click Tablet Order. The tablet ordering screen opens in a new tab." },
      { title: "Select and customize a product", details: "Choose a product, select its variant, and add optional toppings or add-ons to the cart." },
      { title: "Review the cart", details: "Check the items, quantities, add-ons, and total amount." },
      { title: "Enter order details", details: "Select Dine-in or Takeout, then enter the customer name, table number, and special requests." },
      { title: "Select payment details", details: "Choose the payment method and enter the payment reference if needed." },
      { title: "Review and submit", details: "Click Review Order, verify the details, and confirm the order." },
      { title: "Verify the order", details: "Check that the order number appears and that the order is sent to the cashier and kitchen queues." },
    ],
  },
];

function TutorialSection({ tutorial, open, onToggle }: { tutorial: Tutorial; open: boolean; onToggle: () => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E9DFDB] bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[#FCFAF9] sm:p-6"
        aria-expanded={open}
      >
        <span>
          <span className="block text-lg font-bold text-[#2D2626]">{tutorial.title}</span>
          <span className="mt-1 block text-sm text-[#796E6B]">{tutorial.description}</span>
        </span>
        <FiChevronDown className={`shrink-0 text-[#A76560] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[#EEE5E1] px-5 pb-6 pt-5 sm:px-6">
          <ol className="space-y-4">
            {tutorial.steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8EDEA] text-xs font-bold text-[#A76560]">{index + 1}</span>
                <div>
                  <h3 className="font-bold text-[#514441]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#796E6B]">{step.details}</p>
                  {step.items && <ul className="mt-2 list-disc pl-5 text-sm text-[#796E6B]">{step.items.map((item) => <li key={item}>{item}</li>)}</ul>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export default function HelpPage() {
  const [openSection, setOpenSection] = useState("Admin Guide");

  return (
    <div className="flex min-h-screen bg-[#FAF6F4] text-[#2D2626]">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1100px]">
          <header className="mb-7 rounded-2xl border border-[#E9DFDB] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F8EDEA] text-[#A76560]"><FiHelpCircle size={23} /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A46F69]">BrewTrack support</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#2D2626]">Help & User Manual</h1>
                <p className="mt-2 text-sm leading-6 text-[#796E6B]">Find step-by-step instructions for signing in, managing the café, processing orders, and using the kitchen.</p>
              </div>
            </div>
          </header>

          <section className="mb-5 overflow-hidden rounded-2xl border border-[#E9DFDB] bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#EEE5E1] p-5 sm:p-6">
              <FiBookOpen className="text-[#A76560]" size={20} />
              <div>
                <h2 className="text-lg font-bold text-[#2D2626]">Getting started</h2>
                <p className="mt-1 text-sm text-[#796E6B]">{signIn.description}</p>
              </div>
            </div>
            <ol className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              {signIn.steps.map((step, index) => (
                <li key={step.title} className="rounded-xl bg-[#FBF8F6] p-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#A76560]">Step {index + 1}</span>
                  <h3 className="mt-2 font-bold text-[#514441]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#796E6B]">{step.details}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="space-y-4">
            {tutorials.map((tutorial) => (
              <TutorialSection
                key={tutorial.title}
                tutorial={tutorial}
                open={openSection === tutorial.title}
                onToggle={() => setOpenSection((current) => current === tutorial.title ? "" : tutorial.title)}
              />
            ))}
          </div>

          <footer className="mt-5 flex items-center gap-2 rounded-xl border border-[#E9DFDB] bg-[#F3ECE8] p-4 text-sm text-[#796E6B]">
            <FiLogOut className="shrink-0 text-[#A76560]" />
            When you finish your work, click <strong className="text-[#514441]">Log out</strong> to end your session.
          </footer>
        </div>
      </main>
    </div>
  );
}
