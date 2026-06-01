/** Classes partilhadas — alinhadas à sidebar (slate + cyan). */

export const platformDialog =
  "border-slate-200/80 bg-slate-50 text-slate-800 shadow-xl rounded-2xl";

export const platformDialogHeaderIcon =
  "w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-sm";

export const platformPrimaryButton =
  "rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white gap-2 shadow-sm shadow-cyan-500/15 font-semibold";

export const platformListItem =
  "w-full text-left p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all group flex items-start gap-3";

export const platformListItemIcon =
  "w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0";

export const platformSegmentTab = (active: boolean) =>
  `flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
    active
      ? "bg-white text-cyan-600 shadow-sm border border-slate-200/60"
      : "text-slate-500 hover:text-slate-800 hover:bg-white/60 border border-transparent"
  }`;

export const platformFab =
  "w-14 h-14 rounded-2xl bg-white border border-slate-200/80 text-cyan-600 shadow-lg shadow-slate-200/60 hover:shadow-xl hover:border-slate-300 flex items-center justify-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer";

export const platformFabOpen =
  "w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:bg-slate-900 active:scale-[0.98] cursor-pointer";

export const platformQuickAction =
  "flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-md shadow-slate-200/40 hover:border-slate-300 hover:shadow-lg transition-all text-left min-w-[210px] cursor-pointer";
