const MergeContext = {
  _context: null,

  set(sourceUrl, revisions, branchLabel) {
    this._context = { sourceUrl, revisions, branchLabel };
  },

  get() {
    return this._context;
  },

  clear() {
    this._context = null;
  }
};

window.MergeContext = MergeContext;
