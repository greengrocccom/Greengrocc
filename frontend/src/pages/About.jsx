import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Leaf,
  Sprout,
  Store,
  Truck,
  CalendarClock,
  ChefHat,
  ShieldCheck,
  RotateCcw,
  Wallet,
  Users,
  Building2,
  Tractor,
} from "lucide-react";
import api from "../api/api";
import OptimizedImg from "../components/common/OptimizedImg";
import PolicyBody from "../components/legal/PolicyBody";
import { findLivePolicy } from "../components/legal/PolicyPage";

const HERO_IMAGE = "/assets/features/vegetable_basket_sunlight.jpg";

const HOW_WE_WORK = [
  {
    icon: Tractor,
    title: "Sourced from farmers",
    desc: "We buy fruits and vegetables directly from partner farmers and collection centres across Maharashtra — fewer middlemen, fairer prices for growers.",
  },
  {
    icon: Store,
    title: "Stocked in local dark stores",
    desc: "Produce and daily essentials are quality-checked and kept in GreenGrocc dark stores close to your neighbourhood in Mumbai.",
  },
  {
    icon: Truck,
    title: "Delivered to your door",
    desc: "Orders are packed at the store nearest to you and handed to a GreenGrocc delivery partner. Every delivery is verified with an OTP.",
  },
];

const WAYS_TO_SHOP = [
  {
    icon: Truck,
    title: "Instant Orders",
    desc: "Fresh produce, dairy, bakery and staples delivered quickly from your nearest dark store.",
  },
  {
    icon: CalendarClock,
    title: "Pre-Orders",
    desc: "Pick a date and delivery slot in advance. Pre-order produce is harvested and sourced fresh for your slot.",
  },
  {
    icon: ChefHat,
    title: "Ready2Cook",
    desc: "Cleaned, cut and ready-to-cook ingredients that save time in the kitchen on busy days.",
  },
];

const PROMISES = [
  { icon: Leaf, text: "Farm-fresh fruits & vegetables" },
  { icon: Sprout, text: "Direct support for local farmers" },
  { icon: ShieldCheck, text: "Quality checks before every dispatch" },
  { icon: RotateCcw, text: "Easy returns for damaged or spoiled items" },
  { icon: Wallet, text: "UPI, cards, net banking & Cash on Delivery" },
  { icon: Truck, text: "OTP-verified doorstep delivery" },
];

const WHO_WE_SERVE = [
  {
    icon: Users,
    title: "Households",
    desc: "Everyday groceries for families who want fresher food without a trip to the market.",
  },
  {
    icon: Building2,
    title: "Businesses",
    desc: "Bulk accounts for restaurants, caterers, offices and retailers, with business pricing and order quantities.",
  },
  {
    icon: Tractor,
    title: "Farmers",
    desc: "A steady, transparent market for growers who partner with us to sell their harvest.",
  },
];

function HeroImage() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border-light shadow-sm">
      <OptimizedImg
        src={HERO_IMAGE}
        alt="Basket of fresh vegetables from GreenGrocc partner farms"
        className="w-full h-64 sm:h-80 object-cover"
      />
    </div>
  );
}

function AboutCta() {
  return (
    <section className="px-3 sm:px-4 py-10 sm:py-12 pb-16 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-text-primary mb-3">Start shopping fresh</h2>
        <p className="text-text-secondary mb-6 leading-relaxed">
          Browse today&apos;s harvest, or get in touch if you have a question,
          want a bulk account, or are a farmer interested in partnering with us.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-primary text-white px-6 py-3 font-semibold hover:brightness-110 transition"
          >
            Shop Now
          </Link>
          <Link
            to="/contact"
            className="rounded-lg border border-primary text-primary px-6 py-3 font-semibold hover:bg-primary/5 transition"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}

/** About content written in Admin → Policy Management → Users (page: About Us). */
function AdminAbout({ title, body }) {
  return (
    <div className="info-page legal-page">
      <section className="page-hero-section px-3 sm:px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <h1 className="page-title">{title}</h1>
          <HeroImage />
        </div>
      </section>
      <section className="legal-content px-3 sm:px-4 pb-10 sm:pb-12 border-b border-border-light">
        <div className="max-w-4xl mx-auto text-text-secondary leading-relaxed">
          <PolicyBody text={body} />
        </div>
      </section>
      <AboutCta />
    </div>
  );
}

function About() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/admin-ops/policies/live", { params: { role: "customer" } })
      .then((res) => {
        if (!cancelled) setPolicy(findLivePolicy(res.data?.data, "about"));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="info-page legal-page">
        <section className="page-hero-section px-3 sm:px-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-text-secondary">Loading…</p>
          </div>
        </section>
      </div>
    );
  }

  if (policy?.body?.trim()) {
    return <AdminAbout title={policy.title?.trim() || "About GreenGrocc"} body={policy.body} />;
  }

  return <DefaultAbout />;
}

function DefaultAbout() {
  return (
    <div className="info-page legal-page">
      <section className="page-hero-section px-3 sm:px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <h1 className="page-title">About GreenGrocc</h1>
            <p className="text-text-secondary text-lg leading-relaxed">
              GreenGrocc is a Mumbai-based online grocery platform that brings
              fresh fruits, vegetables, dairy, bakery, staples and daily
              essentials from local farms straight to your doorstep.
            </p>
            <p className="text-text-secondary mt-4 leading-relaxed">
              We started GreenGrocc with a simple idea: the food on your table
              should be fresh, honestly priced, and the farmers who grow it
              should get a fair deal. By working directly with farmers across
              Maharashtra and delivering from neighbourhood dark stores, we cut
              out the long supply chain between the farm and your kitchen.
            </p>
          </div>
          <HeroImage />
        </div>
      </section>

      <section className="legal-content px-3 sm:px-4 pb-10 sm:pb-12 border-b border-border-light">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6 sm:gap-10">
          <div className="rounded-2xl border border-border-light bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-text-primary mb-3">Our Mission</h2>
            <p className="text-text-secondary leading-relaxed">
              Make fresh, healthy groceries easy to get for every home in Mumbai
              — while building a fair and reliable market for the farmers who
              grow our food.
            </p>
          </div>
          <div className="rounded-2xl border border-border-light bg-white p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-text-primary mb-3">Rooted in Maharashtra</h2>
            <p className="text-text-secondary leading-relaxed">
              Much of what we sell is grown by partner farmers across
              Maharashtra, including farmer collectives in Nashik. Buying from
              GreenGrocc keeps more of every rupee with local growers and their
              communities.
            </p>
          </div>
        </div>
      </section>

      <section className="px-3 sm:px-4 py-10 sm:py-12 border-b border-border-light">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-6">From Farm to Your Kitchen</h2>
          <ol className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {HOW_WE_WORK.map(({ icon: Icon, title, desc }, index) => (
              <li
                key={title}
                className="rounded-2xl border border-border-light bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-3 sm:px-4 py-10 sm:py-12 border-b border-border-light">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Ways to Shop</h2>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {WAYS_TO_SHOP.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border-light bg-white p-6 shadow-sm"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-3 sm:px-4 py-10 sm:py-12 border-b border-border-light">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Why GreenGrocc?</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-text-secondary">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-lg border border-border-light bg-neutral-50 px-4 py-3"
              >
                <Icon className="w-5 h-5 text-primary shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-3 sm:px-4 py-10 sm:py-12 border-b border-border-light">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Who We Serve</h2>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {WHO_WE_SERVE.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border-light bg-white p-6 shadow-sm"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AboutCta />
    </div>
  );
}

export default About;
