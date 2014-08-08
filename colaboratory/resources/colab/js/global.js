goog.provide('colab.Global');



/**
 * Global state for notebook
 * @final @constructor
 */
colab.Global = function() {
  /** @type {colab.Notebook} Main notebook object. */
  this.notebook = null;

  /** @type {IPython.Kernel} Global Kernel. */
  this.kernel = null;

  /**
   * TODO(colab-team): Create our own base class that wraps session and gets
   *     the kernel.
   * @type {IPython.Session} Global Session.
   */
  this.session = null;

  /**
   * TODO(kayur): move global to notebook, since it is the sharing state for the
   *    notebook. Can't do it, because it's needed before notebook is
   *    fully created
   * @type {colab.sharing.SharingState}
   */
  this.sharingState = null;

  /**
   * @type {gapi.drive.realtime.Collaborator}
   */
  this.me = null;


  /**
   * @type {colab.Preferences} Notebook Preferences
   */
  this.preferences = null;


  /**
   * @type {colab.model.Notebook};
   */
  this.notebookModel = null;
};
goog.addSingletonGetter(colab.Global);
