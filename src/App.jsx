// src/App.jsx
import React, { useState, useMemo } from "react";
import { generatePdfPacket } from "./pdf/generatePacket";

// ═══════════════════════════════════════════════════════════════════════════════
// NC YEAR'S ALLOWANCE CALCULATOR
// For Surviving Spouses Under N.C.G.S. § 30-15
// ═══════════════════════════════════════════════════════════════════════════════

const SPOUSE_ALLOWANCE = 60000;
const MARCH_1_2024 = new Date("2024-03-01");

const ASSET_CATEGORIES = [
  { value: "cash", label: "Cash", eligible: true, icon: "💵" },
  { value: "bank_account", label: "Bank Account", eligible: true, icon: "🏦" },
  { value: "brokerage", label: "Brokerage / Investments", eligible: true, icon: "📈" },
  { value: "vehicle", label: "Vehicle", eligible: true, icon: "🚗" },
  { value: "household_goods", label: "Household Goods", eligible: true, icon: "🛋️" },
  { value: "tools_equipment", label: "Tools / Equipment", eligible: true, icon: "🔧" },
  { value: "business_interest", label: "Business Interest", eligible: true, icon: "💼" },
  { value: "refund_tax", label: "Tax Refund", eligible: true, icon: "📋" },
  { value: "life_insurance", label: "Life Insurance (to estate)", eligible: true, icon: "📄" },
  { value: "other_personal", label: "Other Personal Property", eligible: true, icon: "📦" },
  { value: "real_property", label: "Real Property (Not Eligible)", eligible: false, icon: "🏠" },
];

const NC_COUNTIES = [
  "Alamance","Alexander","Alleghany","Anson","Ashe","Avery","Beaufort","Bertie","Bladen","Brunswick","Buncombe","Burke","Cabarrus","Caldwell","Camden","Carteret","Caswell","Catawba","Chatham","Cherokee","Chowan","Clay","Cleveland","Columbus","Craven","Cumberland","Currituck","Dare","Davidson","Davie","Duplin","Durham","Edgecombe","Forsyth","Franklin","Gaston","Gates","Graham","Granville","Greene","Guilford","Halifax","Harnett","Haywood","Henderson","Hertford","Hoke","Hyde","Iredell","Jackson","Johnston","Jones","Lee","Lenoir","Lincoln","Macon","Madison","Martin","McDowell","Mecklenburg","Mitchell","Montgomery","Moore","Nash","New Hanover","Northampton","Onslow","Orange","Pamlico","Pasquotank","Pender","Perquimans","Person","Pitt","Polk","Randolph","Richmond","Robeson","Rockingham","Rowan","Rutherford","Sampson","Scotland","Stanly","Stokes","Surry","Swain","Transylvania","Tyrrell","Union","Vance","Wake","Warren","Washington","Watauga","Wayne","Wilkes","Wilson","Yadkin","Yancey"
];

const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const isPostMarch2024 = (d) => (d ? new Date(d) >= MARCH_1_2024 : null);
const uid = () => Math.random().toString(36).substr(2, 9);

const STEPS = [
  { id: "intro", title: "Welcome", icon: "👋" },
  { id: "decedent", title: "Decedent", icon: "📋" },
  { id: "date", title: "Date & Form", icon: "📅" },
  { id: "spouse", title: "Petitioner", icon: "👤" },
  { id: "pr", title: "Personal Rep", icon: "⚖️" },
  { id: "assets", title: "Assets", icon: "💰" },
  { id: "assign", title: "Assignment", icon: "✅" },
  { id: "review", title: "Review", icon: "📄" },
];

export default function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    decedentName: "",
    county: "",
    fileNumber: "",
    dateOfDeath: "",
    domicileInNC: true,

    spouseName: "",
    spouseAddress: "",
    spouseCity: "",
    spouseState: "NC",
    spouseZip: "",
    spousePhone: "",

    hasPR: false,
    prName: "",
    prAddress: "",
    lettersIssuedDate: "",

    assets: [],
    assigned: {},
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isPost = isPostMarch2024(form.dateOfDeath);
  const formVer = isPost ? "7/24" : "9/21";

  const eligible = useMemo(() => {
    return form.assets.filter((a) => {
      const cat = ASSET_CATEGORIES.find((c) => c.value === a.category);
      return cat?.eligible !== false && a.isPersonalProperty !== false;
    });
  }, [form.assets]);

  const totalEligible = useMemo(() => {
    return eligible.reduce((s, a) => s + (parseFloat(a.value) || 0), 0);
  }, [eligible]);

  const totalAssigned = useMemo(() => {
    return Object.entries(form.assigned).reduce((s, [id, amt]) => {
      const asset = form.assets.find((a) => a.id === id);
      return asset && eligible.includes(asset) ? s + (parseFloat(amt) || 0) : s;
    }, 0);
  }, [form.assigned, form.assets, eligible]);

  const deficiency = Math.max(0, SPOUSE_ALLOWANCE - totalAssigned);
  const hasDeficiency = deficiency > 0 && totalAssigned > 0;

  const deadline = useMemo(() => {
    if (!isPost || !form.hasPR || !form.lettersIssuedDate) return null;
    const d = new Date(form.lettersIssuedDate);
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [isPost, form.hasPR, form.lettersIssuedDate]);

  const addAsset = () =>
    set("assets", [
      ...form.assets,
      {
        id: uid(),
        description: "",
        category: "bank_account",
        location: "",
        value: "",
        isPersonalProperty: true,
      },
    ]);

  const updateAsset = (id, field, val) => {
    set(
      "assets",
      form.assets.map((a) => {
        if (a.id !== id) return a;
        const updated = { ...a, [field]: val };
        if (field === "category") {
          const cat = ASSET_CATEGORIES.find((c) => c.value === val);
          if (cat?.eligible === false) updated.isPersonalProperty = false;
        }
        return updated;
      })
    );
  };

  const removeAsset = (id) => {
    set("assets", form.assets.filter((a) => a.id !== id));
    const newA = { ...form.assigned };
    delete newA[id];
    set("assigned", newA);
  };

  const assign = (id, amt) => {
    const asset = form.assets.find((a) => a.id === id);
    const max = parseFloat(asset?.value) || 0;
    set("assigned", {
      ...form.assigned,
      [id]: Math.min(Math.max(0, parseFloat(amt) || 0), max),
    });
  };

  const autoAssign = () => {
    const result = {};
    let rem = SPOUSE_ALLOWANCE;
    const order = ["cash", "bank_account", "brokerage", "refund_tax"];
    const sorted = [...eligible].sort((a, b) => {
      const ai = order.indexOf(a.category),
        bi = order.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    for (const asset of sorted) {
      if (rem <= 0) break;
      const val = parseFloat(asset.value) || 0;
      const take = Math.min(val, rem);
      if (take > 0) {
        result[asset.id] = take;
        rem -= take;
      }
    }
    set("assigned", result);
  };

  const clearAssign = () => set("assigned", {});

  const validate = (s) => {
    switch (s) {
      case 1:
        return form.decedentName.trim() && form.county;
      case 2:
        return form.dateOfDeath;
      case 3:
        return form.spouseName.trim();
      case 4:
        return !form.hasPR || (form.prName.trim() && form.lettersIssuedDate);
      case 5:
        return form.assets.length > 0;
      case 6:
        return totalAssigned > 0;
      default:
        return true;
    }
  };

  const canNext = validate(step);
  const next = () => step < STEPS.length - 1 && canNext && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const clearAll = () => {
    if (confirm("Clear all data?")) {
      setForm({
        decedentName: "",
        county: "",
        fileNumber: "",
        dateOfDeath: "",
        domicileInNC: true,

        spouseName: "",
        spouseAddress: "",
        spouseCity: "",
        spouseState: "NC",
        spouseZip: "",
        spousePhone: "",

        hasPR: false,
        prName: "",
        prAddress: "",
        lettersIssuedDate: "",

        assets: [],
        assigned: {},
      });
      setStep(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-5 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">NC Year's Allowance Calculator</h1>
            <p className="text-slate-300 text-sm mt-1">For Surviving Spouses · N.C.G.S. § 30-15</p>
          </div>
          <button
            onClick={clearAll}
            className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition border border-white/20"
          >
            Clear All Data
          </button>
        </div>
      </header>

      {/* Progress */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 overflow-x-auto">
        <div className="max-w-4xl mx-auto flex gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                i === step
                  ? "bg-slate-800 text-white"
                  : i < step
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <span>{s.icon}</span>
              <span className="hidden sm:inline">{s.title}</span>
              {i < step && <span className="text-emerald-600">✓</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          {step === 0 && <IntroStep />}
          {step === 1 && <DecedentStep form={form} set={set} />}
          {step === 2 && <DateStep form={form} set={set} isPost={isPost} formVer={formVer} />}
          {step === 3 && <SpouseStep form={form} set={set} />}
          {step === 4 && <PRStep form={form} set={set} isPost={isPost} deadline={deadline} />}
          {step === 5 && <AssetsStep form={form} addAsset={addAsset} updateAsset={updateAsset} removeAsset={removeAsset} />}
          {step === 6 && (
            <AssignStep
              form={form}
              eligible={eligible}
              totalEligible={totalEligible}
              totalAssigned={totalAssigned}
              deficiency={deficiency}
              assign={assign}
              autoAssign={autoAssign}
              clearAssign={clearAssign}
            />
          )}
          {step === 7 && (
            <ReviewStep
              form={form}
              isPost={isPost}
              formVer={formVer}
              eligible={eligible}
              totalAssigned={totalAssigned}
              deficiency={deficiency}
              hasDeficiency={hasDeficiency}
              deadline={deadline}
            />
          )}
        </div>

        {/* Nav Buttons */}
        <div className="flex justify-between gap-4">
          {step > 0 && (
            <button
              onClick={prev}
              className="px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition"
            >
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button
              onClick={next}
              disabled={!canNext}
              className={`ml-auto px-8 py-3 rounded-xl font-semibold transition ${
                canNext ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              Continue →
            </button>
          )}
        </div>
      </main>

      {/* Disclaimer */}
      <footer className="bg-amber-50 border-t border-amber-200 px-6 py-4">
        <div className="max-w-4xl mx-auto text-sm text-amber-800">
          <strong>⚠️ Disclaimer:</strong> This calculator is for informational purposes only and does not constitute legal
          advice. Verify all values and eligibility. Filing requirements vary by county. Consult an attorney if you have
          questions.
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function IntroStep() {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-4">Welcome</h2>
      <p className="text-lg text-slate-600 mb-8">
        This tool helps surviving spouses in North Carolina calculate and claim their statutory year's allowance.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-left mb-6">
        <h3 className="font-bold text-blue-900 mb-2">💰 What is the Year's Allowance?</h3>
        <p className="text-blue-800">
          Under N.C.G.S. § 30-15, a surviving spouse is entitled to receive up to <strong>$60,000</strong> from the
          deceased spouse's personal property for support during the first year after death.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left mb-6">
        <h3 className="font-bold text-slate-800 mb-3">📋 This tool will help you:</h3>
        <ul className="space-y-2 text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">✓</span> Determine which AOC form version to use
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">✓</span> Identify eligible personal property assets
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">✓</span> Calculate the assignment and any deficiency
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-1">✓</span> Generate pre-filled AOC-E-100 (and E-101 if needed)
          </li>
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-left">
        <h3 className="font-bold text-amber-900 mb-2">⚠️ Before you begin, gather:</h3>
        <ul className="text-amber-800 space-y-1">
          <li>• Information about the decedent's personal property</li>
          <li>• Whether a Personal Representative has been appointed</li>
          <li>• The estate file number (if assigned)</li>
        </ul>
      </div>
    </div>
  );
}

function DecedentStep({ form, set }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Decedent Information</h2>
      <p className="text-slate-600 mb-8">Enter information about the deceased person.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Decedent's Full Legal Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.decedentName}
            onChange={(e) => set("decedentName", e.target.value)}
            placeholder="As shown on death certificate"
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              County <span className="text-red-500">*</span>
            </label>
            <select
              value={form.county}
              onChange={(e) => set("county", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition bg-white"
            >
              <option value="">Select county...</option>
              {NC_COUNTIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Estate File Number
            </label>
            <input
              type="text"
              value={form.fileNumber}
              onChange={(e) => set("fileNumber", e.target.value)}
              placeholder="e.g., 24-E-1234 (optional)"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
            />
            <p className="text-xs text-slate-500 mt-1">Leave blank if not yet assigned</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">NC Connection</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition">
              <input
                type="radio"
                checked={form.domicileInNC}
                onChange={() => set("domicileInNC", true)}
                className="w-5 h-5"
              />
              <span>Decedent was a resident of this county at death</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition">
              <input
                type="radio"
                checked={!form.domicileInNC}
                onChange={() => set("domicileInNC", false)}
                className="w-5 h-5"
              />
              <span>Decedent was not a NC resident, but had personal property in this county</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateStep({ form, set, isPost, formVer }) {
  const deathDate = form.dateOfDeath ? new Date(form.dateOfDeath) : null;
  const oneYear = deathDate ? new Date(new Date(deathDate).setFullYear(deathDate.getFullYear() + 1)) : null;
  const pre2024Passed = !isPost && oneYear && new Date() > oneYear;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Date of Death & Form Selection</h2>
      <p className="text-slate-600 mb-8">The date of death determines which form version and rules apply.</p>

      <div className="mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Date of Death <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={form.dateOfDeath}
          onChange={(e) => set("dateOfDeath", e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full max-w-xs px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
        />
      </div>

      {form.dateOfDeath && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 text-lg mb-3">📋 Form: AOC-E-100 (Rev. {formVer})</h3>
          <p className="text-blue-800 mb-4">
            {isPost
              ? "For deaths on/after March 1, 2024: You'll file a \"Petition\" for year's allowance."
              : "For deaths on/before February 29, 2024: You'll file an \"Application\" for year's allowance."}
          </p>

          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">📅 Deadline Rules:</h4>
            {isPost ? (
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• <strong>No PR appointed:</strong> No general deadline</li>
                <li>• <strong>PR appointed:</strong> Must file within 6 months of letters being issued</li>
                <li>• You must serve a copy of the verified petition on the PR</li>
              </ul>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  Generally must apply within <strong>one year of death</strong>
                </p>
                {pre2024Passed && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    ⚠️ <strong>Warning:</strong> More than one year may have passed. Consult an attorney.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SpouseStep({ form, set }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Surviving Spouse / Petitioner</h2>
      <p className="text-slate-600 mb-8">Enter your information as the surviving spouse.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Your Full Legal Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.spouseName}
            onChange={(e) => set("spouseName", e.target.value)}
            placeholder="Your full legal name"
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Street Address</label>
          <input
            type="text"
            value={form.spouseAddress}
            onChange={(e) => set("spouseAddress", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">City</label>
            <input
              type="text"
              value={form.spouseCity}
              onChange={(e) => set("spouseCity", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
            <input
              type="text"
              value={form.spouseState}
              onChange={(e) => set("spouseState", e.target.value)}
              maxLength={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">ZIP</label>
            <input
              type="text"
              value={form.spouseZip}
              onChange={(e) => set("spouseZip", e.target.value)}
              maxLength={10}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
          <input
            type="tel"
            value={form.spousePhone}
            onChange={(e) => set("spousePhone", e.target.value)}
            placeholder="(555) 555-5555"
            className="w-full max-w-xs px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition"
          />
        </div>
      </div>

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h4 className="font-semibold text-amber-900 mb-2">📝 Notarization Required</h4>
        <p className="text-amber-800 text-sm">
          The AOC-E-100 must be signed in front of a notary public before filing.
        </p>
      </div>
    </div>
  );
}

function PRStep({ form, set, isPost, deadline }) {
  const deadlinePassed = deadline && new Date() > deadline;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Personal Representative</h2>
      <p className="text-slate-600 mb-8">Has an executor or administrator been appointed for the estate?</p>

      <div className="space-y-4 mb-8">
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition">
          <input type="radio" checked={!form.hasPR} onChange={() => set("hasPR", false)} className="w-5 h-5" />
          <span>No Personal Representative has been appointed</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 border-slate-200 hover:bg-slate-50 transition">
          <input type="radio" checked={form.hasPR} onChange={() => set("hasPR", true)} className="w-5 h-5" />
          <span>A Personal Representative has been appointed</span>
        </label>
      </div>

      {form.hasPR && (
        <div className="space-y-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              PR's Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.prName}
              onChange={(e) => set("prName", e.target.value)}
              placeholder="Personal Representative's name"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">PR's Address</label>
            <input
              type="text"
              value={form.prAddress}
              onChange={(e) => set("prAddress", e.target.value)}
              placeholder="For service of petition"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Date Letters Were Issued <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.lettersIssuedDate}
              onChange={(e) => set("lettersIssuedDate", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full max-w-xs px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none transition bg-white"
            />
          </div>

          {isPost && deadline && (
            <div className={`p-4 rounded-xl ${deadlinePassed ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <h4 className={`font-semibold mb-2 ${deadlinePassed ? "text-red-900" : "text-emerald-900"}`}>
                {deadlinePassed ? "⚠️ Deadline May Have Passed" : "📅 Filing Deadline"}
              </h4>
              <p className={deadlinePassed ? "text-red-800" : "text-emerald-800"}>
                Petition must be filed by:{" "}
                <strong>
                  {deadline.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </strong>
              </p>
              {deadlinePassed && <p className="text-red-700 text-sm mt-2">Consult an attorney about your options.</p>}
            </div>
          )}

          {isPost && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <h4 className="font-semibold text-purple-900 mb-2">📬 Service Required</h4>
              <p className="text-purple-800 text-sm">
                You must deliver or mail a copy of the verified petition to the Personal Representative.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssetsStep({ form, addAsset, updateAsset, removeAsset }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Estate Assets</h2>
      <p className="text-slate-600 mb-6">
        Enter the decedent's personal property. Real estate is <strong>not</strong> eligible.
      </p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-sm text-emerald-800">
        💡 Include: bank accounts, vehicles, household goods, investments. Exclude: houses, land.
      </div>

      <div className="space-y-4 mb-6">
        {form.assets.map((asset, i) => {
          const cat = ASSET_CATEGORIES.find((c) => c.value === asset.category);
          const ineligible = cat?.eligible === false || asset.isPersonalProperty === false;

          return (
            <div key={asset.id} className={`rounded-xl border-2 overflow-hidden ${ineligible ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span className="font-semibold text-slate-700">Asset #{i + 1}</span>
                <button onClick={() => removeAsset(asset.id)} className="text-red-500 hover:text-red-700 text-xl">
                  ×
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={asset.category}
                      onChange={(e) => updateAsset(asset.id, "category", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    >
                      {ASSET_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Value ($)</label>
                    <input
                      type="number"
                      value={asset.value}
                      onChange={(e) => updateAsset(asset.id, "value", e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={asset.description}
                    onChange={(e) => updateAsset(asset.id, "description", e.target.value)}
                    placeholder="e.g., Checking ending 1234"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location / Holder</label>
                  <input
                    type="text"
                    value={asset.location}
                    onChange={(e) => updateAsset(asset.id, "location", e.target.value)}
                    placeholder="e.g., First National Bank"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                {ineligible && (
                  <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-red-800 text-sm">
                    ⚠️ Real property is not eligible for year's allowance and won't count toward the $60,000.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {form.assets.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 text-slate-500">
            No assets added yet. Click below to add.
          </div>
        )}
      </div>

      <button
        onClick={addAsset}
        className="w-full py-4 rounded-xl border-2 border-dashed border-slate-400 text-slate-600 font-semibold hover:bg-slate-50 transition"
      >
        + Add Asset
      </button>

      {form.assets.length > 0 && (
        <div className="mt-6 p-4 bg-slate-50 rounded-xl">
          <p className="text-slate-700">
            <strong>Total:</strong> {form.assets.length} asset(s) ·{" "}
            {formatCurrency(form.assets.reduce((s, a) => s + (parseFloat(a.value) || 0), 0))}
          </p>
        </div>
      )}
    </div>
  );
}

function AssignStep({ form, eligible, totalEligible, totalAssigned, deficiency, assign, autoAssign, clearAssign }) {
  const remaining = Math.max(0, SPOUSE_ALLOWANCE - totalAssigned);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Asset Assignment</h2>
      <p className="text-slate-600 mb-6">Select which assets to assign toward the $60,000 allowance.</p>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-100 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Allowance</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(SPOUSE_ALLOWANCE)}</p>
        </div>
        <div className="bg-slate-100 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Eligible Total</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(totalEligible)}</p>
        </div>
        <div className="bg-emerald-100 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-700 uppercase tracking-wide">Assigned</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalAssigned)}</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${remaining > 0 ? "bg-amber-100" : "bg-emerald-100"}`}>
          <p className={`text-xs uppercase tracking-wide ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {remaining > 0 ? "Remaining" : "Complete!"}
          </p>
          <p className={`text-xl font-bold ${remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {remaining > 0 ? formatCurrency(remaining) : "✓"}
          </p>
        </div>
      </div>

      {totalEligible > SPOUSE_ALLOWANCE && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          ℹ️ Your eligible assets exceed $60,000. You can only claim up to the statutory amount.
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <button onClick={autoAssign} className="px-5 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition">
          ✨ Auto-Suggest
        </button>
        <button onClick={clearAssign} className="px-5 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition">
          Clear
        </button>
      </div>

      {/* Asset list */}
      <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700">Eligible Assets</h4>
        </div>
        {eligible.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No eligible assets. Go back and add personal property.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {eligible.map((asset) => {
              const cat = ASSET_CATEGORIES.find((c) => c.value === asset.category);
              const val = parseFloat(asset.value) || 0;
              const assigned = form.assigned[asset.id] || 0;
              const isPartial = assigned > 0 && assigned < val;

              return (
                <div key={asset.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat?.icon}</span>
                      <span className="font-medium text-slate-800">
                        {asset.description || cat?.label}
                        {isPartial && <span className="text-blue-600 text-sm ml-2">(partial)</span>}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {asset.location || "—"} · Value: {formatCurrency(val)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">Assign:</span>
                    <div className="flex items-center">
                      <span className="bg-slate-100 px-3 py-2 rounded-l-lg border border-r-0 border-slate-300 text-slate-600">
                        $
                      </span>
                      <input
                        type="number"
                        value={assigned || ""}
                        onChange={(e) => assign(asset.id, e.target.value)}
                        placeholder="0"
                        min="0"
                        max={val}
                        className="w-28 px-3 py-2 border border-slate-300 rounded-r-lg"
                      />
                    </div>
                    <button
                      onClick={() => assign(asset.id, val)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Full
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deficiency > 0 && totalAssigned > 0 && totalAssigned < totalEligible && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <h4 className="font-semibold text-red-900 mb-1">Deficiency: {formatCurrency(deficiency)}</h4>
          <p className="text-red-800 text-sm">
            Not enough personal property to fully satisfy the allowance. A deficiency judgment (AOC-E-101) will be included.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ form, isPost, formVer, eligible, totalAssigned, deficiency, hasDeficiency, deadline }) {
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const assigned = eligible.filter((a) => (form.assigned[a.id] || 0) > 0);

  // ✅ UPDATED: real client-side PDF generation + download
  const generate = async () => {
    try {
      setGenerating(true);
      await generatePdfPacket({
        formState: form,
        eligibleAssets: eligible,
        formVer,
      });
      setReady(true);
    } catch (e) {
      alert(e?.message || "PDF generation failed.");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Review & Download</h2>
      <p className="text-slate-600 mb-8">Review your information, then generate the pre-filled forms.</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
          <h4 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">📋 Case Info</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Decedent:</span>
              <span className="font-medium">{form.decedentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">County:</span>
              <span className="font-medium">{form.county}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">File No:</span>
              <span className="font-medium">{form.fileNumber || "(TBD)"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date of Death:</span>
              <span className="font-medium">{new Date(form.dateOfDeath).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Form:</span>
              <span className="font-medium">AOC-E-100 (Rev. {formVer})</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
          <h4 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">👤 Petitioner</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Name:</span>
              <span className="font-medium">{form.spouseName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Address:</span>
              <span className="font-medium text-right">
                {form.spouseAddress && `${form.spouseAddress}, `}
                {form.spouseCity} {form.spouseState} {form.spouseZip}
              </span>
            </div>
            {form.spousePhone && (
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="font-medium">{form.spousePhone}</span>
              </div>
            )}
          </div>
        </div>

        {form.hasPR && (
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">⚖️ Personal Rep</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Name:</span>
                <span className="font-medium">{form.prName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Letters Issued:</span>
                <span className="font-medium">{new Date(form.lettersIssuedDate).toLocaleDateString()}</span>
              </div>
              {deadline && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Deadline:</span>
                  <span className="font-medium">{deadline.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
          <h4 className="font-bold text-emerald-800 mb-3 pb-2 border-b border-emerald-200">💰 Allowance</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-700">Statutory:</span>
              <span className="font-bold">{formatCurrency(SPOUSE_ALLOWANCE)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">Assigned:</span>
              <span className="font-bold">{formatCurrency(totalAssigned)}</span>
            </div>
            {hasDeficiency && (
              <div className="flex justify-between">
                <span className="text-red-700">Deficiency:</span>
                <span className="font-bold text-red-700">{formatCurrency(deficiency)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assigned Assets Table */}
      <div className="mb-8">
        <h4 className="font-bold text-slate-800 mb-3">📝 Assets to be Assigned</h4>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Description</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Location</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assigned.map((a) => {
                const amt = form.assigned[a.id] || 0;
                const isPartial = amt < (parseFloat(a.value) || 0);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-sm">
                      {a.description || ASSET_CATEGORIES.find((c) => c.value === a.category)?.label}
                      {isPartial && " (partial)"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{a.location || "—"}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(amt)}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-bold">
                <td colSpan="2" className="px-4 py-3 text-sm">Total Assigned</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalAssigned)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Checklist */}
      <div className="mb-8">
        <h4 className="font-bold text-slate-800 mb-3">✅ Filing Checklist</h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          {[
            "Print and review AOC-E-100 for accuracy",
            "Sign the petition in front of a notary public",
            ...(form.hasPR && isPost ? [`Serve a copy on the Personal Representative (${form.prName})`] : []),
            `File with the Clerk of Superior Court in ${form.county} County`,
            "Pay filing fee ($20 + additional fees)",
            ...(hasDeficiency ? [`File AOC-E-101 Deficiency Judgment for ${formatCurrency(deficiency)}`] : []),
          ].map((item, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded" />
              <span className="text-sm text-slate-700">{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Download */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h4 className="font-bold text-blue-900 mb-3">📄 Generate Forms</h4>
        <p className="text-blue-800 text-sm mb-4">Your download will include:</p>
        <ul className="text-blue-800 text-sm mb-6 space-y-1">
          <li>• AOC-E-100 (Rev. {formVer}) - {isPost ? "Petition" : "Application"} and Assignment</li>
          {hasDeficiency && <li>• AOC-E-101 - Deficiency Judgment ({formatCurrency(deficiency)})</li>}
        </ul>
        <button
          onClick={generate}
          disabled={generating}
          className={`px-6 py-3 rounded-xl font-semibold transition ${
            generating ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {generating ? "⏳ Generating..." : "📥 Generate PDF Packet"}
        </button>
        {ready && (
          <div className="mt-4 p-4 bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-800">
            ✅ <strong>Forms generated!</strong> Your download should have started.
          </div>
        )}
      </div>

      {/* Final Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>⚠️ Final Reminder:</strong> This tool generates pre-filled forms. You must verify all information before filing. This is not legal advice. Filing requirements vary by county. Consult an attorney if you have questions.
      </div>
    </div>
  );
}