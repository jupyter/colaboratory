/**
 *
 * @fileoverview Client IDs for Google API Access.
 *
 * Client IDs are created in the Google Cloud Console, and are used to access
 * Google APIs.  In this case, the Google Drive API is main API being accessed.
 *
 * Client IDs interact with API usage in a number of ways, in particlar:
 *
 *  - All client IDs belong to a cloud console project
 *
 *  - The realtime API uses the client ID to determine which apps can use the
 *    same realtime document.  So apps using different client IDs cannot access
 *    the same realtime document.
 *
 *  - The drive.install OAuth scope installs an app on Google Drive, so that
 *    users can open or create documents from the Google Drive website.  Each
 *    app is configured at the project level, so that each Cloud Console project
 *    corresponds to a single app.
 *
 *  - Chrome Apps can only have one Client ID, and this is a special kind of
 *    client ID that can only be used by Chrome Apps.
 *
 * Because of the above constraints, we must set up client IDs in a very
 * specific manner.  See below for more info.
 *
 * Since all apps (Chrome App and Web App) must be able to share the same
 * realtime document, there must be some cloud console project that contains
 * client IDs for both the Chrome App and the web App.  These are the client
 * IDs colab.client_id.DRIVE_CLIENT_ID, and the client ID listed in the Chrome
 * App manifest colaboratory/chrome/manifest.json.
 *
 * Since Chrome Apps have a single client ID, the Chrome App must use this
 * client ID to install on Drive.  In order to be installed on Drive as a
 * different app (so people can choose whether to open a file in the webapp or
 * the Chrome app), the web app must then use a different client ID, which
 * belongs to a separate cloud console project, to install itself to drive.
 * This is the colab.client_id.INSTALL_CLIENT_ID.
 *
 * Finally, int addition to the drive.install scope, which is used by the webapp
 * to install itself, the welcome screen also requires the
 * drive.readonly.metadata scope, to allow for the "open" dialog in the welcome
 * screen.  This is not strictly necessary since we could switch to the
 * DRIVE_CLIENT_ID when opeining the "open" dialog.  But this isn't
 * implemented in the code yet.
 */

goog.provide('colab.client_id');
goog.provide('colab.scope');

/**
 * OAuth 2.0 scope for installing Drive Apps.
 * @const
 * @type {string}
 */
colab.scope.INSTALL_SCOPE = 'https://www.googleapis.com/auth/drive.install';


/**
 * OAuth 2.0 scope for accessing file metadata, used by the filepicker to
 * display a list of files and let the user select a file.  Note that because
 * this scope doesn't allow for write access to drive, it does not allow for an
 * upload pane in the filepicker.
 * @const
 * @type {string}
 */
colab.scope.FILEPICKER_SCOPE =
    'https://www.googleapis.com/auth/drive.readonly.metadata';


/**
 * OAuth 2.0 scope for opening and creating files.   The drive.file scope would
 * be sufficient in most cases, but this scope is also used to allow for saving
 * and loading data from Google Drive, from the IPython kernel.
 * @const
 * @type {string}
 */
colab.scope.FILE_SCOPE = 'https://www.googleapis.com/auth/drive';


/**
 * Google cloud services client id. Found in the project console for
 * the Jupyter Colaborator project.
 *
 * @const
 * @type {string}
 */
colab.client_id.INSTALL_CLIENT_ID =
    '24495343215-m2uip5p987oi948dikp8khomucgt1b5h.apps.googleusercontent.com';



/**
 * This client is from the same project that is used by chrome app,
 * https://console.developers.google.com/project/apps~windy-ellipse-510/apiui/credential
 * @const
 * @type {string}
 */
colab.client_id.DRIVE_CLIENT_ID =
    '911569945122-tlvi6ucbj137ifhitpqpdikf3qo1mh9d.apps.googleusercontent.com';
