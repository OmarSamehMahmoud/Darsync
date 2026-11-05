/* ============================================================
   Darsync — AI Lecture Studio
   ============================================================ */
'use strict';

window.addEventListener('error', (e) => {
  try { if (typeof toast === 'function') toast('JS error: ' + (e.message || 'unknown'), 'error'); } catch (_) {}
});

// -------------------- State --------------------
const state = {
  token: null,
  user: null,
  taxonomy: { country: [], category: [], subcategory: [], test: [] },
  currentChat: null,
  currentView: 'dashboard',
  streaming: false,
  streamController: null,
  lessonOpenToken: 0,
  lessonMode: false,
  lessonSlides: [],
  lessonSources: [],
  sourcePreviewUrl: null,
  sourcePreviewKey: null,
  sourcePreviewToken: 0,
  currentSlide: 0,
  speechSynthesisActive: false,
  playbackToken: 0,
  playbackRate: 1,
};

const $ = (id) => document.getElementById(id);

const TRANSLATIONS = {
  'Language': 'اللغة',
  'Darsync lecture studio': 'استوديو محاضرات Darsync',
  '2D pharaonic teacher and narration': 'المعلم الفرعوني ثنائي الأبعاد والشرح الصوتي',
  'Your AI Lecture Studio': 'استوديو المحاضرات بالذكاء الاصطناعي',
  'Your lectures, taught by an AI teacher': 'محاضراتك يشرحها لك معلم ذكي',
  'Simple Pricing': 'باقات بسيطة',
  'Choose your plan and continue learning with your existing account.': 'اختر باقتك وتابع التعلم باستخدام حسابك الحالي.',
  'Starter': 'المبتدئة',
  'Professional': 'الاحترافية',
  'Enterprise': 'المؤسسات',
  'Up to 5 study materials': 'حتى ٥ مواد دراسية',
  'Up to 20 study materials': 'حتى ٢٠ مادة دراسية',
  'Unlimited study materials': 'مواد دراسية غير محدودة',
  'Teacher-led lessons': 'دروس يقدمها معلم',
  'Presentation-style lesson player': 'عرض الدروس بأسلوب تقديمي',
  '1 admin account': 'حساب مدير واحد',
  '3 admin accounts': '٣ حسابات للمديرين',
  'Unlimited admin accounts': 'حسابات مديرين غير محدودة',
  'Email support': 'دعم عبر البريد الإلكتروني',
  'Priority email support': 'دعم ذو أولوية عبر البريد الإلكتروني',
  'User management': 'إدارة المستخدمين',
  'Full user management': 'إدارة كاملة للمستخدمين',
  'Dedicated support': 'دعم مخصص',
  '/month': '/شهرياً',
  'Sign In': 'تسجيل الدخول',
  'POPULAR': 'الأكثر شيوعاً',
  'Study materials, animated tutor, and guided lessons': 'مواد دراسية، ومعلم تفاعلي، ودروس موجهة',
  '© 2026 VECTOSAGE': '© 2026 VECTOSAGE',
  'Sign in to your learning workspace': 'سجّل الدخول إلى مساحة التعلم الخاصة بك',
  'Username': 'اسم المستخدم',
  'Password': 'كلمة المرور',
  'your name': 'اسمك',
  'Enter Console': 'دخول إلى المنصة',
  'Dashboard': 'لوحة التحكم',
  'History': 'السجل',
  'Feedback': 'الملاحظات',
  'Study Library': 'المكتبة الدراسية',
  'Settings': 'الإعدادات',
  'Users': 'المستخدمون',
  'Connecting…': 'جارٍ الاتصال…',
  'Toggle theme': 'تبديل السمة',
  'Logout': 'تسجيل الخروج',
  'Hide sidebar': 'إخفاء الشريط الجانبي',
  'Show sidebar': 'إظهار الشريط الجانبي',
  'My Courses': 'دوراتي',
  'Choose a course and topic to start a lesson': 'اختر دورة وموضوعاً لبدء الدرس',
  'Course': 'الدورة',
  'Grade': 'الصف الدراسي',
  'Subject': 'المادة',
  'Unit': 'الوحدة',
  'Semester': 'الفصل الدراسي',
  'Lesson topic': 'موضوع الدرس',
  'Unit / Lesson topic': 'الوحدة / موضوع الدرس',
  'Curriculum Settings': 'إعدادات المنهج',
  '— select —': '— اختر —',
  '— select Grade —': '— اختر الصف الدراسي —',
  '— select Subject —': '— اختر المادة —',
  '— select Semester —': '— اختر الفصل الدراسي —',
  '— select Unit / Lesson topic —': '— اختر الوحدة / موضوع الدرس —',
  'Grade 1': 'الصف الأول الابتدائي',
  'Grade 2': 'الصف الثاني الابتدائي',
  'Grade 3': 'الصف الثالث الابتدائي',
  'Grade 4': 'الصف الرابع الابتدائي',
  'Grade 5': 'الصف الخامس الابتدائي',
  'Grade 6': 'الصف السادس الابتدائي',
  'Arabic': 'اللغة العربية',
  'English': 'اللغة الإنجليزية',
  'Mathematics': 'الرياضيات',
  'Discover': 'اكتشف',
  'Science': 'العلوم',
  'Social Studies': 'الدراسات الاجتماعية',
  'Islamic Religious Education': 'التربية الدينية الإسلامية',
  'Christian Religious Education': 'التربية الدينية المسيحية',
  'Information and Communications Technology': 'تكنولوجيا المعلومات والاتصالات',
  'Professional Skills': 'المهارات المهنية',
  'Art Education': 'التربية الفنية',
  'Physical Education': 'التربية الرياضية',
  'First Semester': 'الفصل الدراسي الأول',
  'Second Semester': 'الفصل الدراسي الثاني',
  'Unit 1': 'الوحدة الأولى',
  'Unit 2': 'الوحدة الثانية',
  'Unit 3': 'الوحدة الثالثة',
  'Unit 4': 'الوحدة الرابعة',
  'Unit 5': 'الوحدة الخامسة',
  'Unit 6': 'الوحدة السادسة',
  'General Review': 'مراجعة عامة',
  'Start Learning': 'ابدأ التعلم',
  'Study Materials': 'المواد الدراسية',
  'indexed materials': 'مواد مفهرسة',
  'Study Sections': 'أقسام الدراسة',
  'ready to teach': 'جاهزة للتدريس',
  'Your Lessons': 'دروسك',
  'lessons in your history': 'دروس في سجلك',
  'Back to courses': 'العودة إلى الدورات',
  'Print or save the teacher explanation as PDF': 'طباعة شرح المعلم أو حفظه بصيغة PDF',
  'Play teacher explanation': 'تشغيل شرح المعلم',
  'Pause teacher explanation': 'إيقاف شرح المعلم مؤقتاً',
  'Save lesson': 'حفظ الدرس',
  'New lesson': 'درس جديد',
  'LESSON OUTLINE': 'خطة الدرس',
  'STUDYING EXCERPTS': 'مراجعة مقتطفات الكتاب',
  'Your teacher is preparing the lesson…': 'يُحضّر معلمك الدرس…',
  'GETTING READY': 'جارٍ التحضير',
  'Preparing your lesson': 'جارٍ تحضير درسك',
  'Your teacher is finding the relevant parts of the selected study materials.': 'يبحث معلمك عن الأجزاء المناسبة في المواد الدراسية المحددة.',
  'From your study materials': 'من موادك الدراسية',
  'Original textbook page': 'صفحة الكتاب الأصلية',
  'Choose a lesson segment': 'اختر جزءًا من الدرس',
  'View excerpt full screen': 'عرض المقتطف بملء الشاشة',
  'Exit full screen': 'الخروج من وضع ملء الشاشة',
  '2D pharaonic teacher avatar': 'شخصية المعلم الفرعوني ثنائية الأبعاد',
  'Your pharaonic teacher': 'مدرّسك الفرعوني',
  'Darsync pharaonic teacher': 'المعلم الفرعوني من Darsync',
  'Darsync pharaonic teacher is speaking': 'المعلم الفرعوني من Darsync يتحدث',
  'NARRATION': 'الشرح الصوتي',
  'READY': 'جاهز',
  "Your teacher's explanation will appear here.": 'سيظهر شرح معلمك هنا.',
  'KEY POINTS': 'النقاط الرئيسية',
  'Lesson takeaways will appear here.': 'ستظهر هنا أهم أفكار الدرس.',
  'READY TO LEARN': 'جاهز للتعلم',
  'Start your lesson': 'ابدأ درسك',
  'Previous lesson segment': 'المقطع السابق',
  'Next lesson segment': 'المقطع التالي',
  'Change narration speed': 'تغيير سرعة الشرح الصوتي',
  '0 / 0 segments': '٠ / ٠ مقاطع',
  'TEXT MODE': 'وضع النص',
  'Library': 'المكتبة',
  '1 · Select grade and subject': '١ · اختر الصف والمادة',
  '2 · Add study materials': '٢ · إضافة مواد دراسية',
  '3 · Study Library': '٣ · المكتبة الدراسية',
  'Drop course PDFs here': 'أفلت ملفات PDF الخاصة بالدورة هنا',
  'Add textbooks, notes, or lecture materials to your study library': 'أضف الكتب أو الملاحظات أو مواد المحاضرات إلى مكتبتك الدراسية',
  'PDFs up to 1 GB are uploaded in chunks and indexed in the background.': 'يتم رفع ملفات PDF حتى 1 جيجابايت على أجزاء وفهرستها في الخلفية.',
  'Browse files': 'استعراض الملفات',
  'Add to Study Library': 'أضف إلى المكتبة الدراسية',
  'Manage the grade, subject, semester, and unit or lesson topic options used to organize study materials.': 'إدارة خيارات الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس لتنظيم المواد الدراسية.',
  'Users & Admin Control': 'إدارة المستخدمين والمديرين',
  'Create, update, and remove students and administrators. Super admin can also assign study library permissions.': 'إنشاء حسابات الطلاب والمديرين وتحديثها وحذفها. ويمكن للمدير العام أيضاً تعيين صلاحيات المكتبة الدراسية.',
  'No users found.': 'لم يتم العثور على مستخدمين.',
  'Confirm': 'تأكيد',
  'Are you sure?': 'هل أنت متأكد؟',
  'Cancel': 'إلغاء',
  'Delete user': 'حذف المستخدم',
  'Are you sure you want to delete this user? This cannot be undone.': 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.',
  'Save scope': 'حفظ النطاق',
  '🎯 Assign course topic': '🎯 تعيين موضوع الدورة',
  'Choose the grade and lesson topic for this study material.': 'اختر الصف وموضوع الدرس لهذه المادة الدراسية.',
  'Lesson History': 'سجل الدروس',
  'Continue any lesson you have already started': 'تابع أي درس بدأت به مسبقاً',
  'Send a suggestion or report an issue': 'أرسل اقتراحاً أو أبلغ عن مشكلة',
  'Add course materials for teacher-led lessons': 'أضف مواد الدورة للدروس التي يقدمها المعلم',
  'Course Settings': 'إعدادات الدورة',
  'Manage grade, subject, semester, and unit or lesson topic options': 'إدارة خيارات الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس',
  'Create and manage student and administrator accounts': 'إنشاء حسابات الطلاب والمديرين وإدارتها',
  'Study material sources': 'مصادر المواد الدراسية',
  'Please select the grade, subject, semester, and unit or lesson topic first': 'يرجى اختيار الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس أولاً',
  'Select a grade, subject, semester, and unit or lesson topic before uploading.': 'اختر الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس قبل رفع الملفات.',
  'Delete': 'حذف',
  'Edit': 'تعديل',
  'Save': 'حفظ',
  'Add': 'إضافة',
  'Search': 'بحث',
  'Loading…': 'جارٍ التحميل…',
  'No lessons found.': 'لم يتم العثور على دروس.',
  'Send feedback': 'إرسال ملاحظات',
  'Suggestion': 'اقتراح',
  'Bug report': 'الإبلاغ عن مشكلة',
  'Title': 'العنوان',
  'Message': 'الرسالة',
  'Submit': 'إرسال',
  'Mark as read': 'تحديد كمقروء',
  'Reply': 'رد',
  'User created': 'تم إنشاء المستخدم',
  'Role updated': 'تم تحديث الدور',
  'User deleted': 'تم حذف المستخدم',
  'Enter username and password first': 'أدخل اسم المستخدم وكلمة المرور أولاً',
  'Password must be at least 8 characters': 'يجب ألا تقل كلمة المرور عن ٨ أحرف',
  'Please enter a username and password': 'يرجى إدخال اسم المستخدم وكلمة المرور',
  'Admin': 'مدير',
  'Super Admin': 'مدير عام',
  'User': 'مستخدم',
  'Admin created': 'تم إنشاء المدير',
  '— choose an item to remove —': '— اختر عنصراً لإزالته —',
  '— list is empty —': '— القائمة فارغة —',
  'Lesson': 'الدرس',
  '— Your AI Lecture Studio': '— استوديو المحاضرات بالذكاء الاصطناعي',
  'Lesson Player': 'مشغل الدروس',
  'NVIDIA NIM offline': 'خدمة NVIDIA NIM غير متصلة',
  'Server offline': 'الخادم غير متصل',
  'PREPARING': 'جارٍ التحضير',
  'PLAYING': 'قيد التشغيل',
  'LESSON COMPLETE': 'اكتمل الدرس',
  'PAUSED': 'متوقف مؤقتاً',
  'UNAVAILABLE': 'غير متاح',
  'Finding the textbook pages': 'جارٍ العثور على صفحات الكتاب',
  'Your teacher is preparing the lesson narration…': 'يُحضّر معلمك الشرح الصوتي للدرس…',
  'Could not load this lesson': 'تعذر تحميل هذا الدرس',
  'Lesson generation failed': 'تعذر إنشاء الدرس',
  'Could not prepare the explanation': 'تعذر تحضير الشرح',
  'Could not prepare the page explanations': 'تعذر تحضير شرح الصفحات',
  'Teacher explanation unavailable': 'شرح المعلم غير متاح',
  'No PDF pages are available.': 'لا توجد صفحات PDF متاحة.',
  'No page explanations are available yet.': 'لا يوجد شرح للصفحات بعد.',
  'There is no lesson to save yet.': 'لا يوجد درس لحفظه بعد.',
  'Popup blocked — allow popups to save the lesson.': 'تم حظر النافذة المنبثقة — اسمح بالنوافذ المنبثقة لحفظ الدرس.',
  'Speech playback is not supported by this browser.': 'هذا المتصفح لا يدعم تشغيل الصوت.',
  'The browser could not play the teacher narration.': 'تعذر على المتصفح تشغيل الشرح الصوتي.',
  'No lessons yet. Choose a course from My Courses to begin.': 'لا توجد دروس بعد. اختر دورة من دوراتي للبدء.',
  'Loading feedback…': 'جارٍ تحميل الملاحظات…',
  'No feedback yet. User suggestions will appear here.': 'لا توجد ملاحظات بعد. ستظهر اقتراحات المستخدمين هنا.',
  'Feedback & Suggestions': 'الملاحظات والاقتراحات',
  'Review the latest input from users and mark it as read when actioned.': 'راجع أحدث ملاحظات المستخدمين وحددها كمقروءة بعد التعامل معها.',
  'unread': 'غير مقروء',
  'Read': 'مقروء',
  'Unread': 'غير مقروء',
  'Admin reply': 'رد المدير',
  'Write a reply to the user...': 'اكتب رداً للمستخدم...',
  'Send reply': 'إرسال الرد',
  'Tell the admin about a bug, idea, or suggestion to improve the platform.': 'أخبر المدير عن مشكلة أو فكرة أو اقتراح لتحسين المنصة.',
  'Type': 'النوع',
  'Add your message before sending feedback': 'أضف رسالتك قبل إرسال الملاحظات',
  'Send to Admin': 'إرسال إلى المدير',
  'Sending...': 'جارٍ الإرسال...',
  'Feedback sent to the admin': 'تم إرسال الملاحظات إلى المدير',
  'Feedback marked as read': 'تم تحديد الملاحظات كمقروءة',
  'Feedback deleted': 'تم حذف الملاحظات',
  'Write a reply before sending': 'اكتب رداً قبل الإرسال',
  'Reply sent to the user': 'تم إرسال الرد إلى المستخدم',
  'Delete feedback': 'حذف الملاحظات',
  'Delete session': 'حذف الجلسة',
  'Remove this feedback from': 'حذف هذه الملاحظات من',
  'Only PDF files are supported': 'الملفات المدعومة بصيغة PDF فقط',
  'Choose a grade, subject, semester, and unit or lesson topic first': 'اختر الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس أولاً',
  'Select a grade, subject, semester, and unit or lesson topic': 'اختر الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس',
  'No pending study materials for this selection': 'لا توجد مواد دراسية معلقة لهذا الاختيار',
  'Adding materials…': 'جارٍ إضافة المواد…',
  'Adding materials failed — check the server log': 'تعذرت إضافة المواد — راجع سجل الخادم',
  'Loading source page…': 'جارٍ تحميل صفحة المصدر…',
  'This source page is unavailable for preview.': 'صفحة المصدر هذه غير متاحة للمعاينة.',
  'Select a grade, subject, semester, and unit or lesson topic to view its study materials.': 'اختر الصف والمادة والفصل الدراسي والوحدة أو موضوع الدرس لعرض المواد الدراسية.',
  'Loading study materials…': 'جارٍ تحميل المواد الدراسية…',
  'No study materials are assigned to this topic yet. Upload PDFs above, then add them to the Study Library.': 'لم يتم تعيين مواد دراسية لهذا الموضوع بعد. ارفع ملفات PDF أعلاه ثم أضفها إلى المكتبة الدراسية.',
  'document': 'مستند',
  'documents': 'مستندات',
  'indexed sections': 'أقسام مفهرسة',
  'Indexed': 'مفهرس',
  'Pending': 'معلق',
  'Assign or change this document\'s selection': 'تعيين هذا المستند أو تغيير اختياره',
  'Re-extract and rebuild the text index': 'إعادة الاستخراج وبناء فهرس النص',
  'Delete this study material': 'حذف هذه المادة الدراسية',
  'Scope': 'النطاق',
  'Set Scope': 'تعيين النطاق',
  'Reindex': 'إعادة الفهرسة',
  'Delete study material': 'حذف المادة الدراسية',
  'Reindex document': 'إعادة فهرسة المستند',
  'Add option': 'إضافة خيار',
  'New grade name…': 'اسم الصف الجديد…',
  'New subject name…': 'اسم المادة الجديدة…',
  'New semester name…': 'اسم الفصل الدراسي الجديد…',
  'New unit / lesson topic name…': 'اسم الوحدة أو موضوع الدرس الجديد…',
  'Add to list': 'إضافة إلى القائمة',
  'Remove option': 'إزالة خيار',
  'choose an item to remove': 'اختر عنصراً لإزالته',
  'list is empty': 'القائمة فارغة',
  'Remove selected option': 'إزالة الخيار المحدد',
  'Show all list': 'عرض القائمة كاملة',
  'No items yet': 'لا توجد عناصر بعد',
  'Select an item to remove first': 'اختر عنصراً لإزالته أولاً',
  'Remove item': 'إزالة العنصر',
  'Add new account': 'إضافة حساب جديد',
  'Add account': 'إضافة حساب',
  'Role for': 'دور',
  'ID': 'المعرّف',
  'Lesson deleted': 'تم حذف الدرس',
  'Course assignment saved': 'تم حفظ تعيين الدورة',
  'Upload': 'رفع',
  'Title (optional)': 'العنوان (اختياري)',
  'Example: Improve user history filters': 'مثال: تحسين خيارات تصفية سجل المستخدم',
  'Your message': 'رسالتك',
  'Share your idea, issue, or suggestion…': 'شارك فكرتك أو مشكلتك أو اقتراحك…',
  'General Feedback': 'ملاحظات عامة',
  'Your Feedback History': 'سجل ملاحظاتك',
  'Previous messages you sent to the admin.': 'الرسائل السابقة التي أرسلتها إلى المدير.',
  'No feedback sent yet. Use the form above to send your first message.': 'لم ترسل أي ملاحظات بعد. استخدم النموذج أعلاه لإرسال رسالتك الأولى.',
  'No title': 'بلا عنوان',
  'Marked read': 'تم تحديدها كمقروءة',
  'Study library permissions': 'صلاحيات المكتبة الدراسية',
  'UPDATE': 'تحديث',
  'ADD': 'إضافة',
  'REMOVE': 'إزالة',
  'Test': 'اختبار',
  'Study material': 'مادة دراسية',
  'unscoped — invisible to users': 'غير محدد النطاق — غير ظاهر للمستخدمين',
  'Enter a name first': 'أدخل اسماً أولاً',
  'Invalid username or password': 'اسم المستخدم أو كلمة المرور غير صحيح',
  'Session expired. Please sign in again.': 'انتهت الجلسة. يرجى تسجيل الدخول مجدداً.',
  'Session expired': 'انتهت الجلسة',
  'Current selection': 'الاختيار الحالي',
  'Indexed materials': 'مواد مفهرسة',
};

const REVERSE_TRANSLATIONS = Object.fromEntries(
  Object.entries(TRANSLATIONS).map(([english, arabic]) => [arabic, english]),
);
let currentLanguage = 'ar';

function translateValue(value, language) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = (language === 'ar' ? TRANSLATIONS : REVERSE_TRANSLATIONS)[trimmed];
  if (translated) return value.replace(trimmed, translated);
  if (language === 'ar') {
    const role = trimmed.match(/^Role for (.+)$/);
    if (role) return value.replace(trimmed, `دور ${role[1]}`);
    const pdfPage = trimmed.match(/^PDF PAGE (\d+)$/);
    if (pdfPage) return value.replace(trimmed, `صفحة PDF ${Number(pdfPage[1]).toLocaleString('ar-EG')}`);
    const progress = trimmed.match(/^(\d+) \/ (\d+) pages$/);
    if (progress) return value.replace(trimmed, `${progress[1]} / ${progress[2]} صفحات`);
    const unread = trimmed.match(/^(\d+) unread$/);
    if (unread) return value.replace(trimmed, `${unread[1]} غير مقروء`);
    const section = trimmed.match(/^Section (.+)$/);
    if (section) return value.replace(trimmed, `القسم ${section[1]}`);
    const page = trimmed.match(/^p\. (.+)$/);
    if (page) return value.replace(trimmed, `ص. ${page[1]}`);
    const documents = trimmed.match(/^(\d+) documents?$/);
    if (documents) return value.replace(trimmed, `${documents[1]} مستند`);
    const upload = trimmed.match(/^Uploaded (\d+) study PDFs? — add them to the Study Library$/);
    if (upload) return value.replace(trimmed, `تم رفع ${upload[1]} من ملفات PDF الدراسية — أضفها إلى المكتبة الدراسية`);
    const indexed = trimmed.match(/^Added (\d+) materials? · (\d+) study sections$/);
    if (indexed) return value.replace(trimmed, `تمت إضافة ${indexed[1]} مواد · ${indexed[2]} أقسام دراسية`);
    const refreshed = trimmed.match(/^Study material refreshed — (\d+) sections$/);
    if (refreshed) return value.replace(trimmed, `تم تحديث المادة الدراسية — ${refreshed[1]} أقسام`);
    const courseSaved = trimmed.match(/^Course assignment saved — (\d+) sections are now available for this topic$/);
    if (courseSaved) return value.replace(trimmed, `تم حفظ تعيين الدورة — أصبحت ${courseSaved[1]} أقسام متاحة لهذا الموضوع`);
    const permission = trimmed.match(/^(update|add|remove) rag updated$/i);
    if (permission) return value.replace(trimmed, `تم تحديث صلاحية ${permission[1].toLowerCase() === 'update' ? 'التحديث' : permission[1].toLowerCase() === 'add' ? 'الإضافة' : 'الإزالة'}`);
  } else {
    const role = trimmed.match(/^دور (.+)$/);
    if (role) return value.replace(trimmed, `Role for ${role[1]}`);
    const pdfPage = trimmed.match(/^صفحة PDF (\d+)$/);
    if (pdfPage) return value.replace(trimmed, `PDF PAGE ${pdfPage[1]}`);
    const progress = trimmed.match(/^(\d+) \/ (\d+) صفحات$/);
    if (progress) return value.replace(trimmed, `${progress[1]} / ${progress[2]} pages`);
    const unread = trimmed.match(/^(\d+) غير مقروء$/);
    if (unread) return value.replace(trimmed, `${unread[1]} unread`);
    const section = trimmed.match(/^القسم (.+)$/);
    if (section) return value.replace(trimmed, `Section ${section[1]}`);
    const page = trimmed.match(/^ص\. (.+)$/);
    if (page) return value.replace(trimmed, `p. ${page[1]}`);
    const documents = trimmed.match(/^(\d+) مستند$/);
    if (documents) return value.replace(trimmed, `${documents[1]} document${Number(documents[1]) === 1 ? '' : 's'}`);
    const upload = trimmed.match(/^تم رفع (\d+) من ملفات PDF الدراسية — أضفها إلى المكتبة الدراسية$/);
    if (upload) return value.replace(trimmed, `Uploaded ${upload[1]} study PDF${Number(upload[1]) === 1 ? '' : 's'} — add them to the Study Library`);
    const indexed = trimmed.match(/^تمت إضافة (\d+) مواد · (\d+) أقسام دراسية$/);
    if (indexed) return value.replace(trimmed, `Added ${indexed[1]} material${Number(indexed[1]) === 1 ? '' : 's'} · ${indexed[2]} study sections`);
    const refreshed = trimmed.match(/^تم تحديث المادة الدراسية — (\d+) أقسام$/);
    if (refreshed) return value.replace(trimmed, `Study material refreshed — ${refreshed[1]} sections`);
    const courseSaved = trimmed.match(/^تم حفظ تعيين الدورة — أصبحت (\d+) أقسام متاحة لهذا الموضوع$/);
    if (courseSaved) return value.replace(trimmed, `Course assignment saved — ${courseSaved[1]} sections are now available for this topic`);
    const permission = trimmed.match(/^تم تحديث صلاحية (التحديث|الإضافة|الإزالة)$/);
    if (permission) return value.replace(trimmed, `${permission[1] === 'التحديث' ? 'update' : permission[1] === 'الإضافة' ? 'add' : 'remove'} rag updated`);
  }
  return value;
}

function translateNode(node, language) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, [data-no-translate]')) return;
    const option = parent.closest('option');
    if (option && !option.closest('#newUserRole, #feedbackType')) {
      const translations = currentLanguage === 'ar' ? TRANSLATIONS : REVERSE_TRANSLATIONS;
      if (!translations[(node.nodeValue || '').trim()]) return;
    }
    const translated = translateValue(node.nodeValue || '', language);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node;
  if (element.matches('script, style, [data-no-translate]')) return;
  for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
    const value = element.getAttribute(attribute);
    if (value) {
      const translated = translateValue(value, language);
      if (translated !== value) element.setAttribute(attribute, translated);
    }
  }
  element.childNodes.forEach((child) => translateNode(child, language));
}

function setLanguage(language) {
  currentLanguage = language === 'en' ? 'en' : 'ar';
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
  document.title = currentLanguage === 'ar' ? 'Darsync — استوديو المحاضرات الذكي' : 'Darsync — AI Lecture Studio';
  const selector = $('languageSelect');
  if (selector) selector.value = currentLanguage;
  translateNode(document.body, currentLanguage);
  localStorage.setItem('px_language', currentLanguage);
  updateSidebarToggle();
}

function initializeLanguage() {
  const savedLanguage = localStorage.getItem('px_language');
  setLanguage(savedLanguage === 'en' ? 'en' : 'ar');
  $('languageSelect')?.addEventListener('change', (event) => setLanguage(event.target.value));
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') translateNode(mutation.target, currentLanguage);
      else if (mutation.type === 'attributes') translateNode(mutation.target, currentLanguage);
      else mutation.addedNodes.forEach((node) => translateNode(node, currentLanguage));
    });
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'],
    characterData: true,
    childList: true,
    subtree: true,
  });
}

function updateSidebarToggle() {
  const button = $('sidebarToggle');
  if (!button) return;
  const hidden = $('appScreen')?.classList.contains('sidebar-hidden');
  const label = hidden ? 'Show sidebar' : 'Hide sidebar';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-expanded', String(!hidden));
  button.title = label;
}

function initializeSidebar() {
  const hidden = localStorage.getItem('px_sidebar_hidden') === 'true';
  $('appScreen').classList.toggle('sidebar-hidden', hidden);
  $('sidebarToggle').addEventListener('click', () => {
    const isHidden = $('appScreen').classList.toggle('sidebar-hidden');
    localStorage.setItem('px_sidebar_hidden', String(isHidden));
    updateSidebarToggle();
  });
  updateSidebarToggle();
}

function isAdminRole(role) {
  return ['admin', 'super_admin'].includes(role || '');
}
function isSuperAdminRole(role) {
  return role === 'super_admin';
}
function defaultUserPermissions(role) {
  return {
    update_rag: role === 'admin' || role === 'super_admin',
    add_rag: role === 'admin' || role === 'super_admin',
    remove_rag: role === 'admin' || role === 'super_admin',
  };
}
function normalizePermissions(raw) {
  const base = defaultUserPermissions('user');
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return base;
  return {
    update_rag: Boolean(parsed.update_rag),
    add_rag: Boolean(parsed.add_rag),
    remove_rag: Boolean(parsed.remove_rag),
  };
}

const api = {
  async call(path, { method = 'GET', body, form } = {}) {
    const db = window.darsyncSupabase;
    if (!db) throw new Error('Supabase is not initialized. Check the project configuration.');
    const fail = (error) => { if (error) throw new Error(error.message || String(error)); };
    const parts = path.split('/').filter(Boolean);
    const verb = method.toUpperCase();

    if (path === '/api/auth/me') return { user: state.user };
    if (path === '/api/status') return { online: false, provider: 'NVIDIA', chat_model: 'Edge Function not connected' };

    if (path === '/api/taxonomy' && verb === 'GET') {
      const { data, error } = await db.from('taxonomy').select('id,type,name').order('name');
      fail(error);
      const result = { country: [], category: [], subcategory: [], test: [] };
      (data || []).forEach((row) => { if (result[row.type]) result[row.type].push(row); });
      return result;
    }
    if (path === '/api/files' && verb === 'GET') {
      const { data, error } = await db.from('study_files').select('*').order('created_at', { ascending: false });
      fail(error);
      return { files: (data || []).map(f => ({ ...f, clauses: f.clauses || 0, ingested: !!f.ingested })) };
    }
    if (path === '/api/chats' && verb === 'GET') {
      const { data, error } = await db.from('chats').select('*').order('updated_at', { ascending: false });
      fail(error); return { chats: data || [] };
    }
    if (path === '/api/chats' && verb === 'POST') {
      const { data, error } = await db.from('chats').insert({ ...body, user_id: state.user.id }).select('*').single();
      fail(error); return data;
    }
    if (parts[0] === 'api' && parts[1] === 'chats' && parts[2] && parts.length === 3) {
      const id = parts[2];
      if (verb === 'GET') {
        const [{ data: chat, error: chatError }, { data: messages, error: msgError }] = await Promise.all([
          db.from('chats').select('*').eq('id', id).single(),
          db.from('messages').select('*').eq('chat_id', id).order('created_at')
        ]);
        fail(chatError); fail(msgError);
        return { ...chat, messages: messages || [] };
      }
      if (verb === 'DELETE') {
        const { error } = await db.from('chats').delete().eq('id', id); fail(error); return { ok: true };
      }
    }
    throw new Error('This feature is not connected to the hosted backend yet. Existing local FastAPI routes are not available on GitHub Pages.');
  },
};

// -------------------- Utilities --------------------
function toast(message, type = 'success') {
  const stack = $('toastStack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
  el.innerHTML = `<span class="t-icon">${icon}</span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = 'all 0.3s'; setTimeout(() => el.remove(), 300); }, 3400);
}

function confirmDialog(title, text) {
  return new Promise((resolve) => {
    $('modalTitle').textContent = title;
    $('modalText').textContent = text;
    const backdrop = $('modalBackdrop');
    backdrop.classList.add('active');
    const done = (val) => { backdrop.classList.remove('active'); cleanup(); resolve(val); };
    const onConfirm = () => done(true);
    const onCancel = () => done(false);
    const cleanup = () => { $('modalConfirm').removeEventListener('click', onConfirm); $('modalCancel').removeEventListener('click', onCancel); };
    $('modalConfirm').addEventListener('click', onConfirm);
    $('modalCancel').addEventListener('click', onCancel);
  });
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  const locale = currentLanguage === 'ar' ? 'ar-EG' : 'en-US';
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ' · ' +
         d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// -------------------- Theme --------------------
function initializeTheme() {
  const html = document.documentElement;
  const themeSwitch = $('theme-switch');
  const savedTheme = localStorage.getItem('px_theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  if (themeSwitch) {
    themeSwitch.checked = savedTheme === 'light';
    themeSwitch.addEventListener('change', function () {
      const newTheme = this.checked ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('px_theme', newTheme);
    });
  }
}

// -------------------- Auth --------------------
function goToAuth() {
  $('landingScreen').classList.remove('active');
  $('authScreen').classList.add('active');
  document.body.classList.remove('app-active');
  $('loginError').textContent = '';
}
window.goToAuth = goToAuth;

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('loginUser').value.trim();
  const password = $('loginPass').value;
  $('loginError').textContent = '';
  try {
    const data = await window.darsyncAuth.signIn(username, password);
    state.token = data.token;
    state.user = data.user;
    $('loginPass').value = '';
    enterApp();
  } catch (err) {
    $('loginError').textContent = err.message;
  }
});

function logout() {
  clearSession();
  $('appScreen').classList.remove('active');
  $('landingScreen').classList.add('active');
  document.body.classList.remove('app-active');
}

function clearSession() {
  cancelLessonPreparation();
  if (window.darsyncAuth) window.darsyncAuth.signOut().catch(() => {});
  state.token = null; state.user = null; state.currentChat = null;
}

function showSignIn(message) {
  clearSession();
  $('appScreen').classList.remove('active');
  $('landingScreen').classList.remove('active');
  $('authScreen').classList.add('active');
  $('loginPass').value = '';
  $('loginError').textContent = message;
  document.body.classList.remove('app-active');
}

$('logoutBtn').addEventListener('click', logout);

// -------------------- Navigation --------------------
const VIEW_META = {
  dashboard: { title: 'My Courses', sub: 'Choose a course and topic to start a lesson' },
  history: { title: 'Lesson History', sub: 'Continue any lesson you have already started' },
  feedback: { title: 'Feedback', sub: 'Send a suggestion or report an issue' },
  newrag: { title: 'Study Library', sub: 'Add course materials for teacher-led lessons' },
  settings: { title: 'Curriculum Settings', sub: 'Manage grade, subject, semester, and unit or lesson topic options' },
  users: { title: 'Users', sub: 'Create and manage student and administrator accounts' },
};

const ADMIN_VIEWS = new Set(['newrag', 'settings']);
const SUPER_ADMIN_VIEWS = new Set(['users']);

function switchView(view) {
  const isAdmin = !!(state.user && isAdminRole(state.user.role));
  const isSuperAdmin = !!(state.user && isSuperAdminRole(state.user.role));
  const isFeedbackView = view === 'feedback';

  if (isSuperAdmin && (view === 'newrag' || view === 'settings' || view === 'feedback')) view = 'users';
  else if (isSuperAdmin && !SUPER_ADMIN_VIEWS.has(view) && !isFeedbackView) view = 'users';
  else if (isAdmin && !isSuperAdmin && !ADMIN_VIEWS.has(view) && !isFeedbackView) view = 'newrag';
  else if (!isAdmin && (ADMIN_VIEWS.has(view) || SUPER_ADMIN_VIEWS.has(view)) && !isFeedbackView) view = 'dashboard';

  if (view !== 'chat') {
    stopLessonSpeech();
    cancelLessonPreparation();
  }
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = $('view-' + view);
  if (target) target.classList.add('active');
  const meta = VIEW_META[view];
  if (meta) { $('viewTitle').textContent = meta.title; $('viewSub').textContent = meta.sub; }
  if (view === 'history') renderHistory();
  if (view === 'feedback') renderFeedback();
  if (view === 'settings') renderSettings();
  if (view === 'users') renderUsers();
  if (view === 'newrag') { renderFiles(); const nc = $('nrContent'); if (nc) nc.scrollTop = 0; }
}

document.querySelectorAll('.nav-item').forEach((n) => n.addEventListener('click', () => switchView(n.dataset.view)));

// -------------------- App entry --------------------
async function enterApp() {
  $('authScreen').classList.remove('active');
  $('landingScreen').classList.remove('active');
  $('appScreen').classList.add('active');
  document.body.classList.add('app-active');
  $('userName').textContent = state.user.username;
  const label = state.user.role === 'super_admin' ? 'Super Admin' : state.user.role === 'admin' ? 'Admin' : 'User';
  $('userRole').textContent = label;
  $('userAvatar').textContent = state.user.username.charAt(0).toUpperCase();
  const isAdmin = isAdminRole(state.user.role);
  const isSuperAdmin = isSuperAdminRole(state.user.role);
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.style.display = isAdmin && !isSuperAdmin ? '' : 'none';
  });
  document.querySelectorAll('.super-admin-only').forEach((el) => {
    el.style.display = isSuperAdmin ? '' : 'none';
  });
  document.querySelectorAll('.user-only').forEach((el) => {
    el.style.display = !isAdmin ? '' : 'none';
  });
  const statusWrap = $('serverStatus');
  if (statusWrap) statusWrap.style.display = isSuperAdmin ? '' : 'none';
  try {
    await Promise.all([loadTaxonomy(), loadStats(), checkStatus()]);
  } catch (err) {
    if (!state.token) return;
    throw err;
  }
  if (isAdmin && !isSuperAdmin) await refreshFeedbackBadge();
  switchView(isSuperAdmin ? 'users' : isAdmin ? 'newrag' : 'dashboard');
}

async function checkStatus() {
  const wrap = $('serverStatus');
  const isSuperAdmin = !!(state.user && state.user.role === 'super_admin');
  if (!wrap) return;
  if (!isSuperAdmin) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  try {
    const s = await api.call('/api/status');
    if (s.online) {
      wrap.classList.add('online'); wrap.classList.remove('offline');
      wrap.querySelector('.status-text').textContent = `${s.provider} · ${s.chat_model} · live`;
    } else {
      wrap.classList.add('offline'); wrap.classList.remove('online');
      wrap.querySelector('.status-text').textContent = 'NVIDIA NIM offline';
    }
  } catch {
    wrap.classList.add('offline'); wrap.classList.remove('online');
    wrap.querySelector('.status-text').textContent = 'Server offline';
  }
}

async function loadTaxonomy() {
  const data = await api.call('/api/taxonomy');
  state.taxonomy = data;
  const labels = { Country: 'Grade', Category: 'Subject', Subcategory: 'Semester', Test: 'Unit / Lesson topic' };
  ['Country', 'Category', 'Subcategory', 'Test'].forEach((label) => {
    const key = label.toLowerCase();
    ['sel', 'nr'].forEach((prefix) => {
      const sel = $(prefix + label);
      if (!sel) return;
      sel.innerHTML = `<option value="">— select ${labels[label]} —</option>` +
        (data[key] || []).map((t) => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
    });
  });
}

async function loadStats() {
  try {
    const [files, chats] = await Promise.all([
      api.call('/api/files').catch(() => ({ files: [] })),
      api.call('/api/chats').catch(() => ({ chats: [] })),
    ]);
    const ingested = files.files.filter((f) => f.ingested);
    const sections = ingested.reduce((sum, f) => sum + (f.clauses || 0), 0);
    $('statFiles').textContent = ingested.length;
    $('statSections').textContent = sections;
    $('statChats').textContent = chats.chats.length;
  } catch { /* ignore */ }
}

// -------------------- Selection + RUN --------------------
function currentSelection() {
  return {
    country: $('selCountry').value,
    category: $('selCategory').value,
    subcategory: $('selSubcategory').value,
    test: $('selTest').value,
  };
}

['selCountry', 'selCategory', 'selSubcategory', 'selTest'].forEach((id) => {
  $(id).addEventListener('change', () => {
    const s = currentSelection();
    const chips = [];
    if (s.country) chips.push(s.country);
    if (s.category) chips.push(s.category);
    if (s.subcategory) chips.push(s.subcategory);
    if (s.test) chips.push(s.test);
    $('selectionChips').innerHTML = chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('');
  });
});

$('runBtn').addEventListener('click', async () => {
  const s = currentSelection();
  if (!s.country || !s.category || !s.subcategory || !s.test) {
    toast('Please select the grade, subject, semester, and unit or lesson topic first', 'error');
    return;
  }
  try {
    const chat = await api.call('/api/chats', {
      method: 'POST',
      body: { ...s, title: `${s.category} · ${s.test}` },
    });
    state.currentChat = chat;
    switchView('chat');
    await openChat(chat.id);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// -------------------- Teacher-led lessons --------------------
function lessonScopeTitle(lesson = state.currentChat) {
  if (!lesson) return 'Lesson';
  return [lesson.country, lesson.category, lesson.subcategory, lesson.test].filter(Boolean).join(' › ');
}

function stopLessonSpeech() {
  state.playbackToken += 1;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  setTutorTalking(false);
  updatePlaybackUI(false);
}

function setTutorTalking(talking) {
  const tutor = $('pharaohTeacher');
  if (!tutor) return;
  tutor.classList.toggle('is-speaking', talking);
  tutor.setAttribute(
    'aria-label',
    currentLanguage === 'ar'
      ? talking ? 'المعلم الفرعوني من Darsync يتحدث' : 'المعلم الفرعوني من Darsync'
      : talking ? 'Darsync pharaonic teacher is speaking' : 'Darsync pharaonic teacher',
  );
}

function resetSourcePreview() {
  state.sourcePreviewToken += 1;
  if (state.sourcePreviewUrl) URL.revokeObjectURL(state.sourcePreviewUrl);
  state.sourcePreviewUrl = null;
  state.sourcePreviewKey = null;
  const image = $('lessonSourcePreviewImage');
  if (image) {
    image.removeAttribute('src');
    image.hidden = true;
  }
}

async function openChat(chatId) {
  cancelLessonPreparation();
  const openToken = ++state.lessonOpenToken;
  stopLessonSpeech();
  state.lessonMode = true;
  state.lessonSlides = [];
  state.lessonSources = [];
  resetSourcePreview();
  state.currentSlide = 0;
  $('viewTitle').textContent = 'Lesson Player';
  $('viewSub').textContent = lessonScopeTitle();
  $('lessonScope').innerHTML = '';
  $('lessonOutline').innerHTML = '<div class="lesson-loading">Your teacher is preparing the lesson…</div>';
  $('lessonSlideKicker').textContent = 'GETTING READY';
  $('lessonSlideTitle').textContent = 'Preparing your lesson';
  $('lessonPrevBtn').disabled = true;
  $('lessonNextBtn').disabled = true;
  $('lessonPlayBtn').disabled = true;
  $('newLessonBtn').disabled = true;
  $('lessonSlideKicker').textContent = currentLanguage === 'ar' ? 'مراجعة مقتطفات الكتاب' : 'STUDYING EXCERPTS';
  $('lessonSlideTitle').textContent = currentLanguage === 'ar' ? 'اختيار أجزاء الدرس' : 'Selecting lesson segments';
  $('lessonSourcePreviewMessage').textContent = currentLanguage === 'ar'
    ? 'جارٍ اختيار مقتطفات الدرس من الكتاب...'
    : 'Selecting lesson excerpts from the textbook…';
  $('lessonSourcePreview').hidden = false;
  $('tutorTranscript').textContent = currentLanguage === 'ar'
    ? 'معلمك بيجهز الشرح الصوتي...'
    : 'Your teacher is preparing the lesson narration…';
  $('tutorNarrationStatus').textContent = 'PREPARING';
  updatePlayerProgress();
  try {
    const data = await api.call('/api/chats/' + chatId);
    if (openToken !== state.lessonOpenToken || state.currentView !== 'chat') return;
    state.currentChat = data.chat;
    $('viewSub').textContent = lessonScopeTitle(data.chat);
    const scope = $('lessonScope');
    [data.chat.country, data.chat.category, data.chat.subcategory, data.chat.test].forEach((v) => {
      if (v) { const el = document.createElement('span'); el.className = 'scope-pill'; el.textContent = v; scope.appendChild(el); }
    });
    $('chatMessages').innerHTML = '';
    const lastAssistant = [...data.messages].reverse().find((message) => message.role === 'assistant');
    const savedLesson = lastAssistant
      && lastAssistant.sources?.length
      && !lastAssistant.qa?.rejected
      && parseLesson(lastAssistant.content, lastAssistant.sources).length === lastAssistant.sources.length
      ? lastAssistant
      : null;
    data.messages.forEach((message) => {
      if (message.role === 'user' || message === savedLesson) {
        appendMessage(message.role, message.content, message === savedLesson ? null : message.sources, false);
      }
    });
    if (savedLesson) {
      state.lessonMode = false;
      renderLesson(savedLesson.content, savedLesson.sources || []);
    } else {
      state.lessonMode = true;
      chatInput.value = makeLessonRequest(data.chat);
      $('chatForm').requestSubmit();
    }
  } catch (err) {
    if (openToken !== state.lessonOpenToken || state.currentView !== 'chat') return;
    state.lessonMode = false;
    toast(err.message, 'error');
    $('lessonSlideTitle').textContent = 'Could not load this lesson';
    $('lessonSourcePreviewMessage').textContent = err.message;
    $('lessonSourcePreview').hidden = false;
    $('lessonPlayBtn').disabled = true;
    $('newLessonBtn').disabled = false;
  }
}

function cancelLessonPreparation() {
  state.lessonOpenToken += 1;
  const controller = state.streamController;
  state.streamController = null;
  state.lessonMode = false;
  if (controller) controller.abort();
  if (!controller && !state.streaming) return;

  state.streaming = false;
  $('sendBtn').disabled = false;
  $('lessonPlayBtn').disabled = true;
  $('newLessonBtn').disabled = false;
  state.lessonSlides = [];
  state.lessonSources = [];
  state.currentSlide = 0;
  resetSourcePreview();
  $('lessonSourcePreview').hidden = true;
  $('lessonSourcePreviewMessage').textContent = '';
  $('lessonSourcePreviewLabel').textContent = '';
  $('lessonOutline').innerHTML = '';
  $('lessonProgress').textContent = '';
  $('tutorTranscript').textContent = '';
  $('tutorNarrationStatus').textContent = 'READY';
  $('chatMessages').querySelectorAll('.msg.pending').forEach((message) => message.remove());
  updatePlayerProgress();
  setChatEmptyVisible(!$('chatMessages').querySelector('.msg'));
}

function showLessonFailure(message) {
  $('lessonSlideKicker').textContent = currentLanguage === 'ar' ? 'الدرس غير متاح' : 'LESSON UNAVAILABLE';
  $('lessonSlideTitle').textContent = currentLanguage === 'ar'
    ? 'تعذر تحضير أجزاء الدرس'
    : 'Could not prepare the lesson segments';
  $('lessonSourcePreviewMessage').textContent = message;
  $('lessonSourcePreview').hidden = false;
  $('lessonSourcePreviewImage').hidden = true;
  $('lessonOutline').innerHTML = `<div class="lesson-loading">${currentLanguage === 'ar' ? 'لا توجد أجزاء جاهزة للشرح.' : 'No lesson segments are available.'}</div>`;
  $('tutorTranscript').textContent = message;
  $('tutorNarrationStatus').textContent = 'UNAVAILABLE';
  $('lessonPlayBtn').disabled = true;
  $('newLessonBtn').disabled = false;
}

function scrollChat() {
  const box = $('chatMessages');
  box.scrollTop = box.scrollHeight;
}

function setChatEmptyVisible(visible) {
  const placeholder = $('chatEmpty');
  if (placeholder) placeholder.style.display = visible ? '' : 'none';
}

function buildSources(sources) {
  const el = document.createElement('div');
  el.className = 'msg-sources';
  el.innerHTML = `<div class="msg-sources-title">Study material sources</div>` +
    sources.map((s) => `<span class="src-pill">📄 ${escapeHtml(s.clause)}${s.title ? ' · ' + escapeHtml(s.title.slice(0, 30)) : ''}</span>`).join('');
  return el;
}

function appendMessage(role, content, sources, animate = true) {
  setChatEmptyVisible(false);
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;
  const avatar = role === 'assistant' ? 'P' : state.user.username.charAt(0).toUpperCase();
  wrap.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body"><div class="msg-text">${escapeHtml(content)}</div></div>`;
  const body = wrap.querySelector('.msg-body');
  if (sources && sources.length) body.appendChild(buildSources(sources));
  $('chatMessages').appendChild(wrap);
  if (animate) scrollChat();
  return { wrap, body, textEl: wrap.querySelector('.msg-text') };
}

function makeLessonRequest(lesson) {
  return [
    'Act as the student’s classroom teacher. Study the supplied PDF excerpts and teach them one short excerpt at a time; do not present the whole PDF.',
    `Course: ${lesson.country}. Subject: ${lesson.category}. Unit: ${lesson.subcategory}. Topic: ${lesson.test}.`,
    'Use only the supplied source excerpts. The corresponding original excerpt from the PDF will be shown beside your explanation; never read it aloud or rewrite its text.',
    'Explain what the student is looking at in friendly, easy Egyptian colloquial Arabic (Masri), like a patient Egyptian teacher speaking directly to a child. Do not use formal Arabic unless a textbook term requires it.',
    'Give exactly one short spoken explanation (2–3 simple sentences) for each supplied [SOURCE EXCERPT N], in order. Explain the idea rather than reading or rewriting the book. Do not create lesson content, exercises, examples absent from the source, or key-point lists.',
    'Return only this format, once per excerpt: SEGMENT 1: a brief navigation title on its own line, followed by the teacher explanation; then SEGMENT 2: its brief title and explanation, continuing in order.',
    'N is the supplied source-excerpt label, not a printed page number. Titles are navigation labels only. If OCR text is unclear, say naturally that this excerpt is not clear instead of guessing.',
  ].join('\n');
}

function parseLesson(answer, sources) {
  const heading = /^\s*SEGMENT\s+(\d+)\s*:\s*(\S.*)\s*$/gim;
  const headings = [...answer.matchAll(heading)];
  const slides = headings.map((match, index) => {
    const sourceId = Number(match[1]);
    const start = match.index + match[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : answer.length;
    return {
      title: match[2].trim(),
      content: answer.slice(start, end).trim(),
      sourceId,
    };
  }).filter((slide) => slide.content && sources[slide.sourceId - 1]);
  return slides.length === sources.length
    && slides.every((slide, index) => slide.sourceId === index + 1)
    ? slides
    : [];
}

function formatPageReference(page) {
  return currentLanguage === 'ar'
    ? `ص. ${Number(page).toLocaleString('ar-EG')}`
    : `p. ${page}`;
}

function renderLesson(answer, sources = []) {
  const slides = parseLesson(answer, sources);
  state.lessonSlides = slides;
  state.lessonSources = sources;
  state.currentSlide = 0;
  renderPageNavigation(slides);
  $('lessonPlayBtn').disabled = !slides.length;
  $('newLessonBtn').disabled = false;
  if (slides.length) {
    showLessonSlide(0);
  } else {
    showLessonFailure('The teacher response did not match the supplied textbook excerpts. Please try again.');
  }
}

function renderPageNavigation(slides) {
  $('lessonOutline').innerHTML = slides.map((slide, index) => `
    <button class="lesson-outline-item ${index === 0 ? 'active' : ''}" type="button" data-slide="${index}">
      <span class="lesson-outline-number">${String(index + 1).padStart(2, '0')}</span>
      <span>${escapeHtml(slide.title)}</span>
    </button>`).join('');
  $('lessonOutline').querySelectorAll('[data-slide]').forEach((button) => {
    button.addEventListener('click', () => showLessonSlide(Number(button.dataset.slide)));
  });
}

function setLessonSources(sources) {
  state.lessonSources = sources;
  state.lessonSlides = [];
  $('lessonOutline').innerHTML = `<div class="lesson-loading">${currentLanguage === 'ar' ? 'معلمك بيراجع مقتطفات الكتاب...' : 'Your teacher is studying the selected book excerpts…'}</div>`;
  $('lessonProgress').textContent = '';
  $('lessonPlayBtn').disabled = true;
}

function showLessonSlide(index) {
  if (index < 0 || index >= state.lessonSlides.length) return;
  stopLessonSpeech();
  state.currentSlide = index;
  const slide = state.lessonSlides[index];
  const source = state.lessonSources[slide.sourceId - 1];
  $('lessonSlideKicker').textContent = currentLanguage === 'ar'
    ? `المقطع ${Number(index + 1).toLocaleString('ar-EG')}`
    : `LESSON SEGMENT ${index + 1}`;
  $('lessonSlideTitle').textContent = slide.title;
  $('lessonProgress').textContent = currentLanguage === 'ar'
    ? `${(index + 1).toLocaleString('ar-EG')} / ${state.lessonSlides.length.toLocaleString('ar-EG')} مقاطع`
    : `${index + 1} / ${state.lessonSlides.length} segments`;
  $('lessonPrevBtn').disabled = index === 0;
  $('lessonNextBtn').disabled = index === state.lessonSlides.length - 1;
  $('playerSlideLabel').textContent = currentLanguage === 'ar' ? 'المقطع الحالي' : 'CURRENT SEGMENT';
  $('playerSlideTitle').textContent = slide.title;
  const sourceIndex = state.lessonSources.findIndex(
    (lessonSource) => lessonSource.source_id === slide.sourceId,
  );
  showLessonSource(sourceIndex);
  $('tutorTranscript').textContent = slide.content;
  $('tutorNarrationStatus').textContent = slide.content ? 'READY' : 'PREPARING';
  $('lessonPlayBtn').disabled = !slide.content;
  updatePlayerProgress();
  $('lessonOutline').querySelectorAll('[data-slide]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.slide) === index);
  });
}

async function showLessonSource(index) {
  const preview = $('lessonSourcePreview');
  const image = $('lessonSourcePreviewImage');
  const label = $('lessonSourcePreviewLabel');
  const message = $('lessonSourcePreviewMessage');
  if (!preview || !image || !label || !message) return;
  const source = state.lessonSources[index];
  if (!source) {
    state.sourcePreviewToken += 1;
    preview.hidden = true;
    return;
  }

  const requestToken = ++state.sourcePreviewToken;
  preview.hidden = false;
  label.textContent = `${currentLanguage === 'ar' ? 'مقتطف من الكتاب' : 'Textbook excerpt'} · ${source.page ? formatPageReference(source.page) : '?'}`;
  if (!source.file_id || !source.page) {
    image.hidden = true;
    message.textContent = 'This source page is unavailable for preview.';
    return;
  }

  const regions = (source.source_regions || []).filter(
    (region) => region && region.x1 > region.x0 && region.y1 > region.y0,
  );
  const crop = regions.length ? {
    x0: Math.min(...regions.map((region) => region.x0)),
    y0: Math.min(...regions.map((region) => region.y0)),
    x1: Math.max(...regions.map((region) => region.x1)),
    y1: Math.max(...regions.map((region) => region.y1)),
  } : null;
  const key = `${source.file_id}:${source.page}:${crop ? Object.values(crop).join(',') : 'full'}`;
  if (state.sourcePreviewKey === key && state.sourcePreviewUrl) {
    image.src = state.sourcePreviewUrl;
    image.hidden = false;
    message.textContent = '';
    return;
  }

  image.hidden = true;
  message.textContent = currentLanguage === 'ar'
    ? 'جارٍ تحميل المقتطف المختار من الكتاب...'
    : 'Loading the selected textbook excerpt…';
  try {
    const params = new URLSearchParams();
    if (crop) Object.entries(crop).forEach(([name, value]) => params.set(name, String(value)));
    const query = params.toString();
    const response = await fetch(
      `/api/files/${source.file_id}/pages/${source.page}/preview${query ? `?${query}` : ''}`,
      { headers: { Authorization: `Bearer ${state.token}` } },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Could not load source page (${response.status})`);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    if (requestToken !== state.sourcePreviewToken) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    if (state.sourcePreviewUrl) URL.revokeObjectURL(state.sourcePreviewUrl);
    state.sourcePreviewUrl = objectUrl;
    state.sourcePreviewKey = key;
    image.src = objectUrl;
    image.hidden = false;
    message.textContent = '';
  } catch (error) {
    if (requestToken === state.sourcePreviewToken) {
      message.textContent = error.message;
    }
  }
}

function updatePlayerProgress() {
  const total = state.lessonSlides.length;
  const current = total ? state.currentSlide + 1 : 0;
  $('playerProgressLabel').textContent = currentLanguage === 'ar'
    ? `${current.toLocaleString('ar-EG')} / ${total.toLocaleString('ar-EG')} مقاطع`
    : `${current} / ${total} segments`;
  $('playerProgressBar').style.width = total ? `${(current / total) * 100}%` : '0%';
}

function updatePlaybackUI(playing) {
  state.speechSynthesisActive = playing;
  setTutorTalking(playing);
  $('lessonPlayBtn').textContent = playing ? 'Ⅱ' : '▶';
  $('lessonPlayBtn').setAttribute('aria-label', playing ? 'Pause teacher explanation' : 'Play teacher explanation');
  $('lessonPlayBtn').title = playing ? 'Pause teacher explanation' : 'Play teacher explanation';
  $('playerPlaybackStatus').textContent = playing ? `${state.playbackRate}× · PLAYING` : 'TEXT MODE';
  $('tutorNarrationStatus').textContent = playing ? 'PLAYING' : 'READY';
}

function startSlideNarration() {
  if (!('speechSynthesis' in window) || !state.lessonSlides.length) {
    toast('Speech playback is not supported by this browser.', 'error');
    return;
  }
  const slide = state.lessonSlides[state.currentSlide];
  const text = `${slide.title}. ${slide.content}`;
  const language = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
  const speech = window.speechSynthesis;
  const voice = speech.getVoices().find((item) => item.lang.toLowerCase().startsWith(language));
  if (!voice) {
    toast(`Install a matching ${language === 'ar' ? 'Arabic' : 'English'} system voice to hear the teacher.`, 'error');
    return;
  }

  speech.cancel();
  const token = ++state.playbackToken;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = state.playbackRate;
  utterance.onstart = () => {
    if (token !== state.playbackToken) return;
    updatePlaybackUI(true);
  };
  utterance.onend = () => {
    if (token !== state.playbackToken) return;
    const nextSlide = state.currentSlide + 1;
    if (nextSlide < state.lessonSlides.length) {
      showLessonSlide(nextSlide);
      startSlideNarration();
    } else {
      updatePlaybackUI(false);
      $('playerPlaybackStatus').textContent = 'LESSON COMPLETE';
    }
  };
  utterance.onerror = (event) => {
    if (token !== state.playbackToken || event.error === 'canceled') return;
    updatePlaybackUI(false);
    toast('The browser could not play the teacher narration.', 'error');
  };
  speech.speak(utterance);
}

$('backToDash').addEventListener('click', () => {
  stopLessonSpeech();
  loadStats();
  switchView('dashboard');
});

$('lessonPrevBtn').addEventListener('click', () => showLessonSlide(state.currentSlide - 1));
$('lessonNextBtn').addEventListener('click', () => showLessonSlide(state.currentSlide + 1));
$('sourceFullscreenBtn').addEventListener('click', async () => {
  const preview = $('lessonSourcePreview');
  try {
    if (document.fullscreenElement === preview) {
      await document.exitFullscreen();
    } else if (preview.requestFullscreen) {
      await preview.requestFullscreen();
    } else {
      throw new Error('Fullscreen is not supported by this browser.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`${currentLanguage === 'ar' ? 'تعذر فتح ملء الشاشة:' : 'Could not open full screen:'} ${message}`, 'error');
  }
});
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = document.fullscreenElement === $('lessonSourcePreview');
  const button = $('sourceFullscreenBtn');
  button.setAttribute('aria-pressed', String(isFullscreen));
  const label = isFullscreen ? 'Exit full screen' : 'View excerpt full screen';
  button.setAttribute('aria-label', label);
  button.title = label;
});
$('lessonPlayBtn').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) {
    toast('Speech playback is not supported by this browser.', 'error');
    return;
  }
  const speech = window.speechSynthesis;
  if (speech.speaking && !speech.paused) {
    speech.pause();
    updatePlaybackUI(false);
    $('playerPlaybackStatus').textContent = 'PAUSED';
  } else if (speech.paused) {
    speech.resume();
    updatePlaybackUI(true);
  } else {
    startSlideNarration();
  }
});
$('lessonSpeedBtn').addEventListener('click', () => {
  const speeds = [0.8, 1, 1.2, 1.5];
  const nextIndex = (speeds.indexOf(state.playbackRate) + 1) % speeds.length;
  state.playbackRate = speeds[nextIndex];
  $('lessonSpeedBtn').textContent = `${state.playbackRate}×`;
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    startSlideNarration();
  }
});

$('newLessonBtn').addEventListener('click', async () => {
  if (!state.currentChat) return;
  const selection = {
    country: state.currentChat.country,
    category: state.currentChat.category,
    subcategory: state.currentChat.subcategory,
    test: state.currentChat.test,
  };
  try {
    const lesson = await api.call('/api/chats', {
      method: 'POST',
      body: { ...selection, title: `${selection.category} · ${selection.test}` },
    });
    state.currentChat = lesson;
    await openChat(lesson.id);
  } catch (err) { toast(err.message, 'error'); }
});

function exportCurrentLessonToPdf() {
  if (!state.currentChat || !state.lessonSlides.length) {
    toast('There is no lesson to save yet.', 'error');
    return;
  }
  const slides = state.lessonSlides.map((slide) => `
    <section class="slide">
      <small>${escapeHtml(formatPageReference(state.lessonSources[slide.sourceId - 1]?.page || slide.sourceId))}</small>
      <h2>${escapeHtml(slide.title)}</h2>
      <p>${escapeHtml(slide.content).replace(/\r?\n/g, '<br>')}</p>
    </section>`).join('');
  const html = `
    <html><head><title>${escapeHtml(state.currentChat.title || 'Lesson')}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#20202a;line-height:1.6}h1{color:#806044}.slide{page-break-after:always;padding:16px 0}.slide h2{color:#806044}small{color:#777;letter-spacing:1px}@media print{body{padding:10mm}}</style>
    </head><body><h1>${escapeHtml(state.currentChat.title || 'Lesson')}</h1>${slides}</body></html>`;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast('Popup blocked — allow popups to save the lesson.', 'error');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
}

$('exportPdfBtn').addEventListener('click', exportCurrentLessonToPdf);

// -------------------- Scope modal --------------------
let scopeFileId = null;
function fillSelect(id, key, selected) {
  const sel = $(id);
  const items = state.taxonomy[key] || [];
  sel.innerHTML = `<option value="">— select —</option>` +
    items.map((t) => `<option value="${escapeHtml(t.name)}" ${t.name === selected ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
}
function openScopeModal(btn) {
  scopeFileId = btn.dataset.scope;
  $('scopeFileName').textContent = btn.dataset.fname;
  fillSelect('scopeCountry', 'country', btn.dataset.country);
  fillSelect('scopeCategory', 'category', btn.dataset.category);
  fillSelect('scopeSubcategory', 'subcategory', btn.dataset.subcategory);
  fillSelect('scopeTest', 'test', btn.dataset.test);
  $('scopeBackdrop').classList.add('active');
}
function closeScope() { $('scopeBackdrop').classList.remove('active'); scopeFileId = null; }
$('scopeCancel').addEventListener('click', closeScope);
$('scopeBackdrop').addEventListener('click', (e) => { if (e.target.id === 'scopeBackdrop') closeScope(); });
$('scopeSave').addEventListener('click', async () => {
  if (!scopeFileId) return;
  const body = {
    country: $('scopeCountry').value, category: $('scopeCategory').value,
    subcategory: $('scopeSubcategory').value, test: $('scopeTest').value,
  };
  if (!body.country || !body.category || !body.subcategory || !body.test) {
    toast('Select a grade, subject, semester, and unit or lesson topic', 'error'); return;
  }
  try {
    const res = await api.call(`/api/files/${scopeFileId}/scope`, { method: 'POST', body });
    toast(`Course assignment saved — ${res.updated} sections are now available for this topic`);
    closeScope();
    renderFiles();
    loadStats();
  } catch (err) { toast(err.message, 'error'); }
});

// Auto-grow textarea
const chatInput = $('chatInput');
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
});
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chatForm').requestSubmit(); }
});

document.querySelectorAll('.suggestion').forEach((btn) => {
  btn.addEventListener('click', () => { chatInput.value = btn.textContent; $('chatForm').requestSubmit(); });
});

// -------------------- SSE streaming --------------------
$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question || state.streaming || !state.currentChat) return;
  const lessonMode = state.lessonMode;
  state.lessonMode = false;

  const controller = new AbortController();
  state.streamController = controller;
  const userMessage = appendMessage('user', question, null);
  userMessage.wrap.classList.add('pending');
  chatInput.value = '';
  chatInput.style.height = 'auto';
  state.streaming = true;
  $('sendBtn').disabled = true;

  const { body, textEl } = appendMessage('assistant', '', null);
  body.closest('.msg').classList.add('pending');
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  textEl.appendChild(cursor);
  let acc = '';
  let lessonSources = [];
  let streamCompleted = false;
  let rejectedLesson = false;
  $('lessonPlayBtn').disabled = true;
  $('newLessonBtn').disabled = true;
  $('tutorTranscript').textContent = 'Your teacher is preparing the lesson narration…';
  $('tutorNarrationStatus').textContent = 'PREPARING';

  try {
    const res = await fetch(`/api/chats/${state.currentChat.id}/stream`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({
        question,
        lesson_mode: lessonMode,
        retrieval_query: [
          state.currentChat.country,
          state.currentChat.category,
          state.currentChat.subcategory,
          state.currentChat.test,
        ].filter(Boolean).join(' '),
      }),
    });
    if (!res.ok || !res.body) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (state.streamController !== controller) break;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) handleEvent(part, (event, data) => {
        if (event === 'sources') {
          const sources = JSON.parse(data);
          lessonSources = sources;
          setLessonSources(sources);
          if (!lessonMode) body.appendChild(buildSources(sources));
          scrollChat();
        } else if (event === 'segment') {
          const progress = JSON.parse(data);
          $('lessonProgress').textContent = currentLanguage === 'ar'
            ? `${Number(progress.index).toLocaleString('ar-EG')} / ${Number(progress.total).toLocaleString('ar-EG')} مقاطع`
            : `${progress.index} / ${progress.total} segments`;
          $('playerProgressLabel').textContent = $('lessonProgress').textContent;
          $('playerProgressBar').style.width = `${(progress.index / progress.total) * 100}%`;
          $('lessonSourcePreviewMessage').textContent = currentLanguage === 'ar'
            ? `معلمك بيجهز المقطع ${Number(progress.index).toLocaleString('ar-EG')} من ${Number(progress.total).toLocaleString('ar-EG')}...`
            : `Your teacher is preparing segment ${progress.index} of ${progress.total}…`;
        } else if (event === 'qa') {
          const qa = JSON.parse(data);
          if (qa.rejected) {
            rejectedLesson = true;
            toast(`Lesson needs review (${qa.score}/100)`, 'error');
          }
        } else if (event === 'token') {
          acc += JSON.parse(data);
          textEl.textContent = acc;
          textEl.appendChild(cursor);
          scrollChat();
        } else if (event === 'error') {
          throw new Error(JSON.parse(data));
        } else if (event === 'done') {
          streamCompleted = true;
        }
      });
    }
    if (!streamCompleted) throw new Error('The lesson stream ended before the presentation was complete.');
  } catch (err) {
    if (controller.signal.aborted || err.name === 'AbortError') return;
    toast(err.message, 'error');
    textEl.textContent = '⚠️ ' + err.message;
    showLessonFailure(err.message);
  } finally {
    cursor.remove();
    if (state.streamController !== controller) return;
    state.streamController = null;
    state.streaming = false;
    $('sendBtn').disabled = false;
    $('lessonPlayBtn').disabled = !streamCompleted;
    $('newLessonBtn').disabled = false;
    userMessage.wrap.classList.remove('pending');
    body.closest('.msg').classList.remove('pending');
    if (streamCompleted && acc.trim() && !rejectedLesson) {
      renderLesson(acc, lessonSources);
    } else if (rejectedLesson) {
      const message = 'The teacher explanation could not be matched to the supplied textbook excerpts. Please try again.';
      textEl.textContent = `⚠️ ${message}`;
      showLessonFailure(message);
      $('lessonPlayBtn').disabled = true;
    }
    loadStats();
  }
});

function handleEvent(raw, cb) {
  const lines = raw.split('\n');
  let event = 'message', data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  cb(event, data);
}

// -------------------- History --------------------
async function renderHistory() {
  const list = $('historyList');
  list.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const { chats } = await api.call('/api/chats');
    if (!chats.length) {
      list.innerHTML = `<div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <p>No lessons yet. Choose a course from My Courses to begin.</p></div>`;
      return;
    }
    list.innerHTML = '';
    chats.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'history-item glass';
      item.innerHTML = `
        <div class="history-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="2"/></svg></div>
        <div class="history-meta">
          <strong>${escapeHtml(c.title)}</strong>
          <span>${fmtDate(c.updated_at)}</span>
        </div>
        <div class="history-tags">
          ${[c.country, c.category, c.subcategory, c.test].filter(Boolean).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="history-del" title="Delete">🗑</div>`;
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('history-del')) return;
        state.currentChat = c;
        switchView('chat');
        await openChat(c.id);
      });
      item.querySelector('.history-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await confirmDialog('Delete session', `Delete "${c.title}"? This cannot be undone.`)) {
          await api.call('/api/chats/' + c.id, { method: 'DELETE' });
          toast('Lesson deleted');
          renderHistory();
          loadStats();
        }
      });
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function refreshFeedbackBadge() {
  const badge = $('feedbackBadge');
  if (!state.user || !isAdminRole(state.user.role) || !badge) return;
  try {
    const { count } = await api.call('/api/feedback/unread-count');
    const unread = Number(count || 0);
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.hidden = unread <= 0;
  } catch {
    badge.hidden = true;
  }
}

async function renderFeedback() {
  const root = $('feedbackViewContent');
  if (!root) return;

  if (state.user && isAdminRole(state.user.role)) {
    root.innerHTML = '<div class="empty-state">Loading feedback…</div>';
    try {
      const { items = [] } = await api.call('/api/feedback');
      if (!items.length) {
        root.innerHTML = '<div class="empty-state"><p>No feedback yet. User suggestions will appear here.</p></div>';
        await refreshFeedbackBadge();
        return;
      }
      root.innerHTML = `
        <div class="feedback-header">
          <div>
            <h3>Feedback & Suggestions</h3>
            <p>Review the latest input from users and mark it as read when actioned.</p>
          </div>
          <span class="badge ${items.some((i) => !i.read) ? 'warn' : 'ok'}">${items.filter((i) => !i.read).length} unread</span>
        </div>
        <div class="feedback-list" id="adminFeedbackList"></div>
      `;
      const list = $('adminFeedbackList');
      items.forEach((item) => {
        const card = document.createElement('div');
        card.className = `feedback-item ${item.read ? 'read' : 'unread'}`;
        const typeLabel = item.type === 'suggestion' ? 'Suggestion' : 'Feedback';
        const replyBlock = item.admin_reply
          ? `<div class="feedback-reply"><strong>Admin reply</strong><p>${escapeHtml(item.admin_reply)}</p><span>${fmtDate(item.replied_at)}</span></div>`
          : `<div class="feedback-compose">
              <textarea data-feedback-reply="${item.id}" rows="3" placeholder="Write a reply to the user..."></textarea>
              <div class="feedback-actions">
                <button class="btn btn-primary btn-sm" type="button" data-reply="${item.id}">Send reply</button>
              </div>
            </div>`;
        const actions = `
          <div class="feedback-actions">
            ${item.read ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-read="' + item.id + '">Mark as read</button>'}
            <button class="btn btn-danger btn-sm" type="button" data-delete-feedback="${item.id}">Delete</button>
          </div>`;

        card.innerHTML = `
          <div class="feedback-item-header">
            <div>
              <strong>${escapeHtml(item.username)}</strong>
              <span>${typeLabel}</span>
            </div>
            <span class="badge ${item.read ? 'ok' : 'warn'}">${item.read ? 'Read' : 'Unread'}</span>
          </div>
          ${item.title ? `<h4>${escapeHtml(item.title)}</h4>` : ''}
          <p>${escapeHtml(item.message)}</p>
          <div class="feedback-meta">
            <span>${fmtDate(item.created_at)}</span>
            ${item.read ? `<span>Marked read ${fmtDate(item.read_at)}</span>` : ''}
          </div>
          ${replyBlock}
          ${actions}`;

        const readBtn = card.querySelector('[data-read]');
        if (readBtn) {
          readBtn.addEventListener('click', async () => {
            try {
              await api.call(`/api/feedback/${item.id}/read`, { method: 'POST' });
              toast('Feedback marked as read');
              await refreshFeedbackBadge();
              await renderFeedback();
            } catch (err) { toast(err.message, 'error'); }
          });
        }

        const replyBtn = card.querySelector('[data-reply]');
        if (replyBtn) {
          replyBtn.addEventListener('click', async () => {
            const replyInput = card.querySelector('[data-feedback-reply="' + item.id + '"]');
            const message = (replyInput?.value || '').trim();
            if (!message) { toast('Write a reply before sending', 'error'); return; }
            try {
              await api.call(`/api/feedback/${item.id}/reply`, { method: 'POST', body: { message } });
              toast('Reply sent to the user');
              await renderFeedback();
            } catch (err) { toast(err.message, 'error'); }
          });
        }

        const deleteBtn = card.querySelector('[data-delete-feedback]');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            const username = escapeHtml(item.username);
            if (await confirmDialog('Delete feedback', `Remove this feedback from ${username}?`)) {
              try {
                await api.call(`/api/feedback/${item.id}`, { method: 'DELETE' });
                toast('Feedback deleted');
                await refreshFeedbackBadge();
                await renderFeedback();
              } catch (err) { toast(err.message, 'error'); }
            }
          });
        }
        list.appendChild(card);
      });
      await refreshFeedbackBadge();
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
    }
    return;
  }

  root.innerHTML = `
    <div class="feedback-header">
      <div>
        <h3>Send feedback</h3>
        <p>Tell the admin about a bug, idea, or suggestion to improve the platform.</p>
      </div>
    </div>
    <form id="feedbackForm" class="feedback-form">
      <label class="field">
        <span class="field-label">Type</span>
        <div class="select-wrap">
          <select id="feedbackType">
            <option value="suggestion">Suggestion</option>
            <option value="feedback">General Feedback</option>
          </select>
          <span class="chevron"></span>
        </div>
      </label>
      <label class="field">
        <span class="field-label">Title (optional)</span>
        <input id="feedbackTitle" type="text" maxlength="80" placeholder="Example: Improve user history filters" />
      </label>
      <label class="field">
        <span class="field-label">Your message</span>
        <textarea id="feedbackMessage" rows="6" placeholder="Share your idea, issue, or suggestion…" required></textarea>
      </label>
      <button type="submit" class="btn btn-primary btn-glow" id="feedbackSubmit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Send to Admin</span>
      </button>
    </form>

    <div class="feedback-history">
      <div class="feedback-header" style="border-bottom:none; padding-top: 16px;">
        <div>
          <h3 style="font-size:20px;">Your Feedback History</h3>
          <p style="margin-top:6px; color:var(--text-muted); font-size:13px;">Previous messages you sent to the admin.</p>
        </div>
      </div>
      <div class="feedback-list" id="userFeedbackList"></div>
    </div>
  `;

  const form = $('feedbackForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = $('feedbackType').value;
    const title = $('feedbackTitle').value.trim();
    const message = $('feedbackMessage').value.trim();
    if (!message) { toast('Add your message before sending feedback', 'error'); return; }
    const submitBtn = $('feedbackSubmit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 2v20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Sending...';
    try {
      await api.call('/api/feedback', { method: 'POST', body: { type, title, message } });
      toast('Feedback sent to the admin');
      form.reset();
      await renderUserFeedbackHistory();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> <span>Send to Admin</span>';
    }
  });

  await renderUserFeedbackHistory();
}

async function renderUserFeedbackHistory() {
  const list = $('userFeedbackList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state">Loading your history…</div>';
  try {
    const { items = [] } = await api.call('/api/feedback/my');
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><p>No feedback sent yet. Use the form above to send your first message.</p></div>';
      return;
    }
    list.innerHTML = '';
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = `feedback-item ${item.read ? 'read' : 'unread'}`;
      const typeLabel = item.type === 'suggestion' ? 'Suggestion' : 'Feedback';
      const replyBlock = item.admin_reply
        ? `<div class="feedback-reply"><strong>Admin reply</strong><p>${escapeHtml(item.admin_reply)}</p><span>${fmtDate(item.replied_at)}</span></div>`
        : '';
      card.innerHTML = `
        <div class="feedback-item-header">
          <div>
            <strong>${typeLabel}</strong>
            <span>${item.title || 'No title'}</span>
          </div>
          <span class="badge ${item.read ? 'ok' : 'warn'}">${item.read ? 'Read' : 'Unread'}</span>
        </div>
        <p>${escapeHtml(item.message)}</p>
        <div class="feedback-meta">
          <span>${fmtDate(item.created_at)}</span>
          ${item.read ? `<span>Marked read ${fmtDate(item.read_at)}</span>` : ''}
        </div>
        ${replyBlock}`;
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// -------------------- New RAG nav --------------------
(function initNewRagNav() {
  const content = $('nrContent');
  const nav = $('nrNav');
  if (!content || !nav) return;

  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (el) content.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
  };
  nav.querySelectorAll('.nr-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => jumpTo(btn.dataset.target));
  });
  $('nrUp').addEventListener('click', () => content.scrollBy({ top: -content.clientHeight * 0.85, behavior: 'smooth' }));
  $('nrDown').addEventListener('click', () => content.scrollBy({ top: content.clientHeight * 0.85, behavior: 'smooth' }));

  const sections = ['nr-params', 'nr-upload', 'nr-docs'].map((id) => document.getElementById(id)).filter(Boolean);
  content.addEventListener('scroll', () => {
    const mid = content.scrollTop + content.clientHeight * 0.3;
    let current = sections.length ? sections[0].id : null;
    for (const s of sections) { if (s.offsetTop <= mid) current = s.id; }
    if (current) nav.querySelectorAll('.nr-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.target === current));
  });
})();

$('browseBtn').addEventListener('click', () => $('fileInput').click());
$('uploadZone').addEventListener('click', (e) => { if (e.target.id !== 'browseBtn') $('fileInput').click(); });
$('fileInput').addEventListener('change', (e) => { if (e.target.files.length) uploadSelected(e.target.files); });

const NEW_RAG_SCOPE_FIELDS = ['country', 'category', 'subcategory', 'test'];
let filesRenderRequest = 0;

function getNewRagSelection() {
  return {
    country: $('nrCountry').value,
    category: $('nrCategory').value,
    subcategory: $('nrSubcategory').value,
    test: $('nrTest').value,
  };
}

function matchesNewRagSelection(file, selection) {
  return NEW_RAG_SCOPE_FIELDS.every((field) => file[field] === selection[field]);
}

['nrCountry', 'nrCategory', 'nrSubcategory', 'nrTest'].forEach((id) => {
  $(id).addEventListener('change', renderFiles);
});

const uploadZone = $('uploadZone');
['dragenter', 'dragover'].forEach((ev) => uploadZone.addEventListener(ev, (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) => uploadZone.addEventListener(ev, (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); }));
uploadZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) uploadSelected(e.dataTransfer.files); });

async function uploadSelected(fileList) {
  const pdfs = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) { toast('Only PDF files are supported', 'error'); return; }

  const { country, category, subcategory, test } = getNewRagSelection();
  if (!country || !category || !subcategory || !test) {
    toast('Choose a grade, subject, semester, and unit or lesson topic first', 'error');
    document.getElementById('nr-params')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const form = new FormData();
  pdfs.forEach((f) => form.append('files', f));
  form.append('country', country);
  form.append('category', category);
  form.append('subcategory', subcategory);
  form.append('test', test);
  try {
    const res = await api.call('/api/files/upload', { method: 'POST', form });
    toast(`Uploaded ${res.count} study PDF${res.count > 1 ? 's' : ''} — add them to the Study Library`);
    $('fileInput').value = '';
    renderFiles();
  } catch (err) { toast(err.message, 'error'); }
}

async function waitForIndexJob(fileId, jobId, onProgress) {
  while (true) {
    const job = await api.call(`/api/files/${fileId}/index-jobs/${jobId}`);
    onProgress(job);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(job.error || 'PDF indexing failed.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

$('ingestBtn').addEventListener('click', async () => {
  const selection = getNewRagSelection();
  if (!NEW_RAG_SCOPE_FIELDS.every((field) => selection[field])) {
    toast('Choose a grade, subject, semester, and unit or lesson topic first', 'error');
    document.getElementById('nr-params')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const btn = $('ingestBtn');
  const label = btn.querySelector('span');
  const originalHtml = label.innerHTML;
  btn.disabled = true;
  label.innerHTML = 'Adding materials…';
  try {
    const files = (await api.call('/api/files')).files;
    const pending = files.filter((f) => matchesNewRagSelection(f, selection) && !f.ingested);
    if (!pending.length) { toast('No pending study materials for this selection', 'info'); return; }
    let totalClauses = 0, okCount = 0, failed = 0;
    for (const f of pending) {
      const current = okCount + failed + 1;
      label.textContent = `Adding ${current}/${pending.length}…`;
      try {
        const job = await api.call(`/api/files/${f.id}/ingest`, { method: 'POST' });
        if (job.job_id) {
          const result = await waitForIndexJob(f.id, job.job_id, (progress) => {
            label.textContent = `Adding ${current}/${pending.length} · ${progress.pages_processed}/${progress.pages_total || '?'} pages`;
          });
          totalClauses += result.clauses || 0;
        }
        okCount++;
      } catch (err) {
        failed++;
        toast(`Failed to index "${f.filename}": ${err.message}`, 'error');
      }
    }
    if (okCount) toast(`Added ${okCount} material${okCount > 1 ? 's' : ''} · ${totalClauses} study sections`);
    else if (failed) toast('Adding materials failed — check the server log', 'error');
    renderFiles();
    loadStats();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    label.innerHTML = originalHtml;
  }
});

async function renderFiles() {
  const table = $('filesTable');
  const selection = getNewRagSelection();
  const requestId = ++filesRenderRequest;
  if (!NEW_RAG_SCOPE_FIELDS.every((field) => selection[field])) {
    table.innerHTML = `<div class="empty-state"><p>Select a grade, subject, semester, and unit or lesson topic to view its study materials.</p></div>`;
    return;
  }

  table.innerHTML = `<div class="empty-state"><p>Loading study materials…</p></div>`;
  let files;
  try {
    files = (await api.call('/api/files')).files.filter((f) => matchesNewRagSelection(f, selection));
  } catch (err) {
    if (requestId !== filesRenderRequest) return;
    table.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
    return;
  }
  if (requestId !== filesRenderRequest) return;
  if (!files.length) {
    table.innerHTML = `<div class="empty-state"><p>No study materials are assigned to this topic yet. Upload PDFs above, then add them to the Study Library.</p></div>`;
    return;
  }
  table.innerHTML = `
    <div class="files-head">
      <h4>Study Materials</h4>
      <span class="files-count">${files.length} document${files.length > 1 ? 's' : ''}</span>
    </div>` +
    files.map((f) => {
      const scoped = f.country && f.category && f.subcategory && f.test;
      const chips = [f.country, f.category, f.subcategory, f.test].filter(Boolean)
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('');
      return `
    <div class="file-row ${scoped ? '' : 'unscoped-row'}">
      <div class="file-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/></svg></div>
      <div class="file-info">
        <strong>${escapeHtml(f.filename)}</strong>
        <div class="file-sel">${chips || '<span class="chip warn">⚠ unscoped — invisible to users</span>'}</div>
        <span class="file-meta">${fmtSize(f.size)} · ${f.clauses || 0} indexed sections</span>
      </div>
      <span class="badge ${f.ingested ? 'ok' : 'pending'}">${f.ingested ? 'Indexed' : 'Pending'}</span>
      <div class="file-actions">
        <button class="btn ${scoped ? 'btn-ghost' : 'btn-primary'} btn-sm" data-scope="${f.id}"
          data-country="${escapeHtml(f.country || '')}" data-category="${escapeHtml(f.category || '')}"
          data-subcategory="${escapeHtml(f.subcategory || '')}" data-test="${escapeHtml(f.test || '')}"
          data-fname="${escapeHtml(f.filename)}" title="Assign or change this document's selection">
          ${scoped ? 'Scope' : 'Set Scope'}
        </button>
        <button class="btn btn-ghost btn-sm" data-reindex="${f.id}" title="Re-extract and rebuild the text index">
          Reindex
        </button>
        <button class="btn btn-danger btn-sm" data-del="${f.id}" title="Delete this study material">
          Delete
        </button>
      </div>
    </div>`;
    }).join('');

  table.querySelectorAll('[data-scope]').forEach((btn) => {
    btn.addEventListener('click', () => openScopeModal(btn));
  });

  table.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.file-row');
      const fname = row.querySelector('strong').textContent;
      if (await confirmDialog('Delete study material', `Remove "${fname}" and all its indexed sections? This cannot be undone.`)) {
        btn.disabled = true;
        try {
          await api.call(`/api/files/${btn.dataset.del}`, { method: 'DELETE' });
          toast('Study material and its indexed content were removed');
        } catch (err) { toast(err.message, 'error'); }
        renderFiles();
        loadStats();
      }
    });
  });

  table.querySelectorAll('[data-reindex]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.file-row');
      const fname = row.querySelector('strong').textContent;
      if (await confirmDialog('Reindex document', `Re-extract and rebuild the text index for "${fname}"?`)) {
        btn.disabled = true;
        try {
          const fileId = btn.dataset.reindex;
          const job = await api.call(`/api/files/${fileId}/reindex`, { method: 'POST' });
          if (job.job_id) {
            const result = await waitForIndexJob(fileId, job.job_id, (progress) => {
              btn.title = `Indexing ${progress.pages_processed}/${progress.pages_total || '?'} pages`;
            });
            toast(`Study material refreshed — ${result.clauses} sections`);
          } else {
            toast('Study material is already being indexed.');
          }
        } catch (err) { toast(err.message, 'error'); }
        renderFiles();
        loadStats();
      }
    });
  });
}

// -------------------- Settings --------------------
const TAX_LABELS = { country: 'Grade', category: 'Subject', subcategory: 'Semester', test: 'Unit / Lesson topic' };
const TAX_ICONS = {
  country: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" stroke="currentColor" stroke-width="2"/></svg>',
  category: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2"/></svg>',
  subcategory: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  test: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 2h6M10 2v6l-4 8a4 4 0 0 0 3.6 6h4.8A4 4 0 0 0 18 16l-4-8V2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

async function renderSettings() {
  const grid = $('settingsGrid');
  grid.innerHTML = '';
  await loadTaxonomy();
  Object.keys(TAX_LABELS).forEach((type) => {
    const items = state.taxonomy[type] || [];
    const card = document.createElement('div');
    card.className = 'settings-card';
    card.innerHTML = `
      <h4>${TAX_ICONS[type]}<span>${TAX_LABELS[type]}</span><span class="tax-count">${items.length}</span></h4>

      <div class="tax-block">
        <label class="tax-block-label">Add option</label>
        <div class="tax-add">
          <input type="text" placeholder="New ${TAX_LABELS[type].toLowerCase()} name…" data-input="${type}" />
          <button class="tax-add-btn" data-add="${type}" title="Add to list">+</button>
        </div>
      </div>

      <div class="tax-block">
        <label class="tax-block-label">Remove option</label>
        <div class="select-wrap">
          <select data-select="${type}">
            <option value="">— ${items.length ? 'choose an item to remove' : 'list is empty'} —</option>
            ${items.map((it) => `<option value="${it.id}">${escapeHtml(it.name)}</option>`).join('')}
          </select>
          <span class="chevron"></span>
        </div>
        <button class="btn btn-ghost btn-remove" data-remove="${type}">Remove selected option</button>
      </div>

      <div class="tax-block">
        <button class="tax-block-label as-toggle" data-toggle="${type}">
          <span class="caret">▸</span> Show all list <span class="tax-inline-count">${items.length}</span>
        </button>
        <div class="tax-chips" data-chips="${type}" hidden>
          ${items.length
            ? items.map((it) => `<span class="tax-chip">${escapeHtml(it.name)}</span>`).join('')
            : '<span class="tax-empty">No items yet</span>'}
        </div>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.add;
      const input = grid.querySelector(`[data-input="${type}"]`);
      const name = input.value.trim();
      if (!name) { toast('Enter a name first', 'error'); return; }
      try {
        await api.call('/api/taxonomy', { method: 'POST', body: { type, name } });
        toast(`${TAX_LABELS[type]} "${name}" added`);
        renderSettings();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  grid.querySelectorAll('[data-input]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); grid.querySelector(`[data-add="${input.dataset.input}"]`).click(); }
    });
  });

  grid.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.remove;
      const select = grid.querySelector(`[data-select="${type}"]`);
      const id = select.value;
      if (!id) { toast('Select an item to remove first', 'error'); return; }
      const name = select.options[select.selectedIndex].text;
      if (await confirmDialog('Remove item', `Remove "${name}" from ${TAX_LABELS[type]}?`)) {
        await api.call('/api/taxonomy/' + id, { method: 'DELETE' });
        toast(`${TAX_LABELS[type]} "${name}" removed`);
        renderSettings();
      }
    });
  });

  grid.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.toggle;
      const chips = grid.querySelector(`[data-chips="${type}"]`);
      const open = chips.hasAttribute('hidden');
      if (open) chips.removeAttribute('hidden'); else chips.setAttribute('hidden', '');
      btn.querySelector('.caret').textContent = open ? '▾' : '▸';
    });
  });
}

async function renderUsers() {
  const grid = $('usersGrid');
  const empty = $('usersEmpty');
  if (!grid) return;
  grid.innerHTML = '';
  empty.style.display = 'none';

  const createCard = document.createElement('div');
  createCard.className = 'settings-card';
  createCard.innerHTML = `
    <h4>➕ Add new account</h4>
    <div class="tax-block">
      <div class="user-create-form">
        <input id="newUserName" type="text" placeholder="Username" />
        <input id="newUserPass" type="password" placeholder="Password" />
        <select id="newUserRole">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button class="btn btn-primary btn-sm" id="createUserBtn" type="button">Add account</button>
      </div>
    </div>
  `;
  grid.appendChild(createCard);

  const createBtn = $('createUserBtn');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const username = $('newUserName').value.trim();
      const password = $('newUserPass').value;
      const role = $('newUserRole').value;
      if (!username || !password) { toast('Enter username and password first', 'error'); return; }
      try {
        await api.call('/api/admin/users', {
          method: 'POST',
          body: { username, password, role, permissions: defaultUserPermissions(role) }
        });
        toast(`${role === 'admin' ? 'Admin' : 'User'} created`);
        $('newUserName').value = '';
        $('newUserPass').value = '';
        renderUsers();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  try {
    const { items = [] } = await api.call('/api/admin/users');
    if (!items.length) {
      empty.style.display = '';
      return;
    }
    items.forEach((u) => {
      const isAdmin = ['admin', 'super_admin'].includes(u.role);
      const isSelf = state.user && u.id === state.user.id;
      const permissions = normalizePermissions(u.permissions);
      const card = document.createElement('div');
      card.className = 'settings-card';
      card.innerHTML = `
        <h4>
          <span class="user-avatar">${u.username.charAt(0).toUpperCase()}</span>
          <span class="user-name">${escapeHtml(u.username)}</span>
          <span class="user-role-badge ${isAdmin ? 'role-admin' : 'role-user'}">${u.role === 'super_admin' ? 'Super Admin' : isAdmin ? 'Admin' : 'User'}</span>
        </h4>
        <div class="tax-block" style="border-top:1px solid var(--border-color); padding-top:14px; margin-top:8px;">
          <div class="tax-add" style="justify-content: space-between; align-items: center;">
            <span class="field-label" style="font-size:11px; color:var(--text-faint);">ID ${u.id} · ${fmtDate(u.created_at)}</span>
            <div style="display:flex; gap:8px;">
              ${!isSelf ? `
                <div class="select-wrap user-role-select">
                  <select data-user-role="${u.id}" aria-label="Role for ${escapeHtml(u.username)}">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                  </select>
                  <span class="chevron"></span>
                </div>
              ` : ''}
              ${!isSelf ? `<button class="btn btn-danger btn-sm" data-delete-user="${u.id}" type="button">Delete</button>` : ''}
            </div>
          </div>
        </div>
        ${isAdmin && u.role !== 'super_admin' ? `
          <div class="tax-block">
            <label class="field-label">Study library permissions</label>
            <div style="display:grid; grid-template-columns: repeat(3, minmax(130px,1fr)); gap:10px; margin-top:8px;">
              ${['update_rag','add_rag','remove_rag'].map((perm) => `
                <label style="display:flex; align-items:center; gap:8px; background: var(--card-bg-secondary); border:1px solid var(--border-color); border-radius: 10px; padding: 10px 12px;">
                  <input type="checkbox" data-user-permission="${u.id}" data-permission="${perm}" ${permissions[perm] ? 'checked' : ''} />
                  <span>${perm.replace('_rag', '').replace('_', ' ').toUpperCase()}</span>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;

      const roleSelect = card.querySelector('[data-user-role]');
      if (roleSelect) {
        roleSelect.addEventListener('change', async () => {
          roleSelect.disabled = true;
          try {
            await api.call(`/api/admin/users/${u.id}/role`, { method: 'PATCH', body: { role: roleSelect.value } });
            toast('Role updated');
            renderUsers();
          } catch (err) {
            roleSelect.value = u.role;
            toast(err.message, 'error');
          } finally {
            roleSelect.disabled = false;
          }
        });
      }

      const deleteBtn = card.querySelector('[data-delete-user]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (await confirmDialog('Delete user', 'Are you sure you want to delete this user? This cannot be undone.')) {
            try {
              await api.call(`/api/admin/users/${u.id}`, { method: 'DELETE' });
              toast('User deleted');
              renderUsers();
            } catch (err) { toast(err.message, 'error'); }
          }
        });
      }

      card.querySelectorAll('[data-user-permission]').forEach((checkbox) => {
        checkbox.addEventListener('change', async () => {
          if (u.role === 'super_admin') return;
          const permission = checkbox.dataset.permission;
          const nextPermissions = { ...permissions, [permission]: checkbox.checked };
          try {
            await api.call(`/api/admin/users/${u.id}/permissions`, { method: 'PATCH', body: { permissions: nextPermissions } });
            toast(`${permission.replace('_', ' ')} updated`);
            renderUsers();
          } catch (err) { toast(err.message, 'error'); }
        });
      });

      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// -------------------- Init --------------------
(async function init() {
  initializeLanguage();
  initializeTheme();
  initializeSidebar();
  try {
    const restored = await window.darsyncAuth.restore();
    if (restored) {
      state.token = restored.token;
      state.user = restored.user;
      await enterApp();
      return;
    }
  } catch (error) {
    console.error('Supabase session restore failed:', error);
  }
  $('landingScreen').classList.add('active');
})();