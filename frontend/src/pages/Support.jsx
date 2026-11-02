import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { submitSupportMessage, uploadImageFile, getSupportContact } from "../api/api";
import { UPLOAD_FOLDERS } from "../utils/uploadFolders";
import { SUPPORT_ISSUE_OPTIONS } from "../utils/supportConstants";
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, CONTACT_WHATSAPP_URL } from "../config/contact";
import OptimizedImg from "../components/common/OptimizedImg";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 1000;

const SUPPORT_CONTACT = {
  phone: CONTACT_PHONE_DISPLAY,
  phoneHref: CONTACT_PHONE_TEL,
  whatsapp: CONTACT_PHONE_DISPLAY,
  whatsappHref: CONTACT_WHATSAPP_URL,
  email: CONTACT_EMAIL,
};

const SUPPORT_FAQS = [
  {
    question: "How can I track my order?",
    answer:
      "Go to My Orders in your account to see live status and tracking details once your order is shipped.",
  },
  {
    question: "What is your return and refund policy?",
    answer:
      "Eligible products can be returned within the return window shown on the product page. Refunds are processed after inspection.",
  },
  {
    question: "How can I cancel my order?",
    answer:
      "Open the order from My Orders and use Cancel if the order is still eligible. For help, contact our support team.",
  },
  {
    question: "How can I upload payment screenshot?",
    answer:
      "Use the attachment field in this support form to upload your payment screenshot, or send it on WhatsApp.",
  },
];

const TRUST_BADGES = [
  {
    title: "100% Original Products",
    desc: "Genuine & trusted",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Secure Payments",
    desc: "100% safe & secure",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0V10.5M4.5 10.5h15v8.25a1.5 1.5 0 01-1.5 1.5h-12a1.5 1.5 0 01-1.5-1.5V10.5z" />
      </svg>
    ),
  },
  {
    title: "Easy Returns",
    desc: "Hassle-free returns",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
      </svg>
    ),
  },
  {
    title: "Fast Delivery",
    desc: "Pan India delivery",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    title: "Dedicated Support",
    desc: "We're here to help",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.375c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375V8.77m0 0a48.897 48.897 0 013.408-.297m1.38 5.093c.7.1 1.416.15 2.146.15s1.446-.05 2.146-.15m-3.592 0V9.75m0 0a48.897 48.897 0 00-3.408-.297" />
      </svg>
    ),
  },
];

const initialForm = {
  name: "",
  email: "",
  phone: "",
  orderId: "",
  issueType: "",
  message: "",
};

function ContactCard({ icon, iconBg, title, children, href, external, compact = false }) {
  const content = (
    <div className={`flex items-start ${compact ? "flex-col gap-2 text-center sm:flex-row sm:text-left" : "gap-4"}`}>
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl ${iconBg} ${
          compact ? "mx-auto h-10 w-10 sm:mx-0" : "h-11 w-11"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={`font-bold text-text-primary ${compact ? "text-xs sm:text-sm" : "text-sm"}`}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );

  const cardClass = `rounded-xl border border-border-light bg-white shadow-sm ${
    compact ? "p-3 sm:p-5" : "p-4 sm:p-5"
  }`;

  if (!href) {
    return <div className={cardClass}>{content}</div>;
  }

  const linkProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <a
      href={href}
      {...linkProps}
      className={`block transition hover:border-primary/40 hover:shadow-md ${cardClass}`}
    >
      {content}
    </a>
  );
}

function Support() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [contactData, setContactData] = useState({
    phone: CONTACT_PHONE_DISPLAY,
    phoneTel: CONTACT_PHONE_TEL,
    whatsapp: CONTACT_PHONE_DISPLAY,
    whatsappHref: CONTACT_WHATSAPP_URL,
    email: CONTACT_EMAIL,
    hours: "Mon – Sat · 10 AM – 10 PM",
    vendorName: "",
    isVendorSpecific: false,
  });

  useEffect(() => {
    let alive = true;
    getSupportContact()
      .then((res) => {
        if (!alive) return;
        const data = res?.data;
        if (data && data.success) {
          setContactData({
            phone: data.phone || CONTACT_PHONE_DISPLAY,
            phoneTel: data.phoneTel || CONTACT_PHONE_TEL,
            whatsapp: data.whatsapp || CONTACT_PHONE_DISPLAY,
            whatsappHref: data.whatsappHref || CONTACT_WHATSAPP_URL,
            email: data.email || CONTACT_EMAIL,
            hours: data.hours || "Mon – Sat · 10 AM – 10 PM",
            vendorName: data.vendorName || "",
            isVendorSpecific: Boolean(data.isVendorSpecific),
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || "",
    }));
  }, [user]);

  const inputClass =
    "w-full rounded-lg border border-border-light bg-white px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20";
  const labelClass = "mb-1.5 block text-sm font-semibold text-text-primary";

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "message" && value.length > MAX_MESSAGE_LENGTH) return;
    setForm({ ...form, [name]: value });
    setError("");
  };

  const processFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WEBP, or GIF)");
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Image must be under 5 MB");
      return;
    }

    setUploadingAttachment(true);
    setError("");

    try {
      const { data } = await uploadImageFile(file, UPLOAD_FOLDERS.SUPPORT);
      const url = data.data.url;
      setAttachment({ name: file.name, url });
      setAttachmentPreview(url);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload attachment");
      setAttachment(null);
      setAttachmentPreview("");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachment(null);
      setAttachmentPreview("");
      return;
    }
    await processFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setAttachmentPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.issueType) {
      setError("Please select an issue type");
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await submitSupportMessage({
        ...form,
        roleKey: "customer",
        attachment: attachment?.url || "",
        attachmentName: attachment?.name || "",
      });

      setSuccess(data.message || "Your support request has been submitted.");
      setForm({
        ...initialForm,
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
      });
      setAttachment(null);
      setAttachmentPreview("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to submit support request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-mobile-bg text-text-primary">
      <section className="px-3 py-4 sm:px-4 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <nav className="mb-4 text-xs text-text-secondary sm:text-sm">
            <Link to="/" className="hover:text-primary">
              Home
            </Link>
            <span className="mx-2">›</span>
            <span className="text-text-primary">Support</span>
          </nav>

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr] lg:gap-8 xl:gap-10">
            <div className="space-y-4">
              <div className="mb-2">
                <h1 className="text-lg font-bold text-text-primary sm:text-xl">
                  How can we help you?
                </h1>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary sm:text-sm">
                  Our support team is here to help you. We&apos;ll get back to you as soon as possible.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
                <ContactCard
                  compact
                  href={SUPPORT_CONTACT.phoneHref}
                  iconBg="bg-orange-100 text-primary"
                  title="Phone"
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25c0 8.284 6.716 15 15 15z" />
                    </svg>
                  }
                >
                  <p className="mt-1 text-xs font-semibold text-primary sm:text-sm">{contactData.phone}</p>
                  <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">Mon – Sat · 10 AM – 10 PM</p>
                </ContactCard>

                <ContactCard
                  compact
                  href={contactData.whatsappHref}
                  external
                  iconBg="bg-green-100 text-green-600"
                  title="WhatsApp"
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  }
                >
                  <p className="mt-1 text-xs font-semibold text-green-600 sm:text-sm">{contactData.whatsapp}</p>
                  <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">Chat on WhatsApp</p>
                </ContactCard>

                <ContactCard
                  compact
                  href={`mailto:${contactData.email}`}
                  iconBg="bg-orange-100 text-primary"
                  title="Email"
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 00-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 00-1.07-1.916V6.75" />
                    </svg>
                  }
                >
                  <p className="mt-1 break-all text-xs font-semibold text-primary sm:text-sm">{contactData.email}</p>
                  <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">Reply within 24 hours</p>
                </ContactCard>

                <ContactCard
                  compact
                  iconBg="bg-blue-100 text-blue-600"
                  title="Office Hours"
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <p className="mt-1 text-[11px] leading-snug text-text-secondary sm:text-sm">Mon – Sat</p>
                  <p className="text-[11px] leading-snug text-text-secondary sm:text-sm">{contactData.hours}</p>
                </ContactCard>
              </div>

              <div className="hidden rounded-xl border border-border-light bg-white p-4 shadow-sm sm:p-5 lg:block">
                <h2 className="mb-4 text-base font-bold text-text-primary">Frequently Asked Questions</h2>
                <div className="space-y-2">
                  {SUPPORT_FAQS.map((faq, index) => (
                    <div key={faq.question} className="overflow-hidden rounded-lg border border-border-light">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-text-primary transition hover:bg-mobile-surface/60"
                      >
                        <span>{faq.question}</span>
                        <span className="shrink-0 text-lg leading-none text-text-muted">
                          {openFaq === index ? "−" : "+"}
                        </span>
                      </button>
                      {openFaq === index && (
                        <p className="border-t border-border-light px-4 py-3 text-sm leading-relaxed text-text-secondary">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <Link
                  to="/shipping-details"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  View all FAQs
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="h-fit rounded-2xl border border-border-light bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24"
            >
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className={labelClass}>
                      Name <span className="text-primary">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      name="name"
                      required
                      placeholder="Enter your name"
                      value={form.name}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Email <span className="text-primary">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      required
                      placeholder="Enter your email"
                      value={form.email}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className={labelClass}>
                      Phone <span className="text-primary">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      name="phone"
                      required
                      placeholder="Enter your phone number"
                      value={form.phone}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="orderId" className={labelClass}>
                      Order ID <span className="font-normal text-text-secondary">(Optional)</span>
                    </label>
                    <input
                      id="orderId"
                      type="text"
                      name="orderId"
                      placeholder="Enter your order ID"
                      value={form.orderId}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="issueType" className={labelClass}>
                    Issue Type <span className="text-primary">*</span>
                  </label>
                  <select
                    id="issueType"
                    name="issueType"
                    required
                    value={form.issueType}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Select issue type</option>
                    {SUPPORT_ISSUE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className={labelClass}>
                    Message <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      required
                      placeholder="Describe your issue in detail..."
                      value={form.message}
                      onChange={handleChange}
                      maxLength={MAX_MESSAGE_LENGTH}
                      className={`${inputClass} resize-none pb-8`}
                    />
                    <span className="pointer-events-none absolute bottom-3 right-3 text-xs text-text-muted">
                      {form.message.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Upload Attachment <span className="font-normal text-text-secondary">(Optional)</span>
                  </label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="rounded-xl border-2 border-dashed border-border-light bg-mobile-surface/30 p-5"
                  >
                    {!attachmentPreview ? (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
                        <svg
                          className="h-10 w-10 text-text-muted"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        <span className="text-sm">
                          <span className="font-semibold text-primary">Click to upload</span>
                          <span className="text-text-secondary"> or drag and drop</span>
                        </span>
                        <span className="text-xs text-text-muted">PNG, JPG up to 2MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAttachmentChange}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-3">
                        <OptimizedImg
                          src={attachmentPreview}
                          alt="Attachment preview"
                          className="h-16 w-16 rounded-lg border border-border-light object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {attachment?.name}
                          </p>
                          <button
                            type="button"
                            onClick={handleRemoveAttachment}
                            className="mt-1 text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {success && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  {submitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="border-t border-border-light bg-white px-2 py-5 sm:px-4 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-5 gap-1.5 sm:gap-3 lg:gap-6">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.title} className="flex min-w-0 flex-col items-center text-center">
              <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary sm:mb-2 sm:h-11 sm:w-11 lg:h-12 lg:w-12">
                <span className="scale-75 sm:scale-90 lg:scale-100">{badge.icon}</span>
              </div>
              <h3 className="text-[9px] font-bold leading-tight text-text-primary sm:text-xs lg:text-sm">
                {badge.title}
              </h3>
              <p className="mt-0.5 text-[8px] leading-tight text-text-secondary sm:text-[10px] lg:text-xs">
                {badge.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Support;
