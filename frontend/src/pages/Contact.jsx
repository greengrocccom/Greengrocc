import { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MessageCircle, Clock, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { submitSupportMessage } from "../api/api";
import useSupportContact from "../hooks/useSupportContact";

const TOPICS = [
  { value: "general", label: "General question", issueType: "other" },
  { value: "order", label: "Help with an order", issueType: "order" },
  { value: "delivery", label: "Delivery / serviceable area", issueType: "delivery" },
  { value: "product", label: "Product or availability", issueType: "product_inquiry" },
  { value: "bulk", label: "Bulk / business account", issueType: "place_order" },
  { value: "farmer", label: "Farmer or vendor partnership", issueType: "other" },
  { value: "feedback", label: "Feedback or suggestion", issueType: "other" },
];

const initialForm = {
  name: "",
  email: "",
  phone: "",
  topic: "general",
  message: "",
};

function Contact() {
  const { user } = useAuth();
  const contact = useSupportContact();
  const [form, setForm] = useState(() => ({
    ...initialForm,
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const topic = TOPICS.find((t) => t.value === form.topic) || TOPICS[0];

    try {
      setSubmitting(true);
      const { data } = await submitSupportMessage({
        name: form.name,
        email: form.email,
        phone: form.phone,
        issueType: topic.issueType,
        message: `[${topic.label}] ${form.message}`,
        roleKey: "customer",
      });
      setSuccess(data?.message || "Thanks for reaching out! Our team will get back to you soon.");
      setForm({
        ...initialForm,
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Could not send your message. Please try again or call us.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border-light bg-white px-4 py-3 text-text-primary placeholder:text-text-secondary/60 focus:border-primary focus:outline-none";

  const contactItems = [
    {
      icon: Phone,
      title: "Phone",
      content: (
        <a href={contact.phoneTel} className="text-primary hover:underline">
          {contact.phone}
        </a>
      ),
    },
    {
      icon: MessageCircle,
      title: "WhatsApp",
      content: (
        <a
          href={contact.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {contact.whatsapp}
        </a>
      ),
    },
    {
      icon: Mail,
      title: "Email",
      content: (
        <a href={`mailto:${contact.email}`} className="text-primary hover:underline break-all">
          {contact.email}
        </a>
      ),
    },
    {
      icon: Clock,
      title: "Support Hours",
      content: <p>{contact.hours}</p>,
    },
    {
      icon: MapPin,
      title: "Office",
      content: <p className="leading-relaxed">GreenGrocc, {contact.address}</p>,
    },
  ];

  return (
    <div className="info-page">
      <section className="page-hero-section px-3 sm:px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16">
          <div>
            <h1 className="page-title">Contact Us</h1>
            <p className="text-text-secondary mb-8 leading-relaxed">
              Questions about an order, delivery in your area, a bulk account,
              or partnering with us as a farmer? We&apos;re happy to help —
              reach us on any of the channels below or send us a message.
            </p>

            <div className="space-y-5 text-text-secondary">
              {contactItems.map(({ icon: Icon, title, content }) => (
                <div key={title} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-text-primary font-semibold mb-0.5">{title}</h3>
                    {content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border-light bg-white p-5 sm:p-8 space-y-4 sm:space-y-5 shadow-sm h-fit"
          >
            <h2 className="text-xl font-bold text-text-primary mb-2">Send us a message</h2>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <input
              type="text"
              name="name"
              placeholder="Your name *"
              required
              value={form.name}
              onChange={handleChange}
              className={inputClass}
            />
            <input
              type="email"
              name="email"
              placeholder="Email *"
              required
              value={form.email}
              onChange={handleChange}
              className={inputClass}
            />
            <input
              type="tel"
              name="phone"
              placeholder="Phone / WhatsApp *"
              required
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
            />
            <select
              name="topic"
              value={form.topic}
              onChange={handleChange}
              className={inputClass}
              aria-label="What is this about?"
            >
              {TOPICS.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
            <textarea
              name="message"
              rows={4}
              maxLength={1000}
              placeholder="How can we help? Include your order ID or area pincode if relevant. *"
              required
              value={form.message}
              onChange={handleChange}
              className={`${inputClass} resize-none`}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary text-white py-3 font-semibold hover:brightness-110 transition disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </section>

      <section className="py-8 sm:py-12 px-3 sm:px-4 text-center border-t border-border-light pb-16">
        <p className="text-text-secondary max-w-xl mx-auto">
          Need help with an existing order? Visit{" "}
          <Link to="/orders" className="text-primary hover:underline">
            My Orders
          </Link>{" "}
          to track, cancel or report an issue, or check our{" "}
          <Link to="/support" className="text-primary hover:underline">
            Help &amp; Support
          </Link>{" "}
          page for FAQs.
        </p>
      </section>
    </div>
  );
}

export default Contact;
