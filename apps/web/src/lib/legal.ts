import type { Locale } from './i18n';

export type LegalSection = { heading: string; body: (string | string[])[] };
export type LegalDoc = { title: string; description: string; updated: string; intro: string; sections: LegalSection[] };

export const legalDetails = {
  entity: process.env.NEXT_PUBLIC_LEGAL_ENTITY || '[legal entity name]',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || '[registered address]',
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '[support email]',
  officer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || '[grievance officer name]',
  officerEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || '[grievance officer email]',
  city: process.env.NEXT_PUBLIC_GOVERNING_CITY || '[city]',
  hosting: process.env.NEXT_PUBLIC_HOSTING_REGION || '[hosting region]',
};

function fill(text: string): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in legalDetails ? legalDetails[key as keyof typeof legalDetails] : match));
}

function filled(doc: LegalDoc): LegalDoc {
  return {
    ...doc,
    intro: fill(doc.intro),
    sections: doc.sections.map((section) => ({
      heading: section.heading,
      body: section.body.map((part) => (Array.isArray(part) ? part.map(fill) : fill(part))),
    })),
  };
}

const privacy: Record<Locale, LegalDoc> = {
  en: {
    title: 'privacy policy',
    description: 'What personal data vela collects, why, who we share it with and how to control it.',
    updated: 'Last updated 23 November 2026',
    intro:
      '{entity} ("vela", "we") sells travel eSIM data plans through the vela app and website. This policy explains what personal data we collect, why, who we share it with and the choices you have. We are responsible for your data under India’s Digital Personal Data Protection Act, 2023 and, for customers in the European Union, the GDPR.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          [
            'Account: your phone number or the email from Apple or Google sign-in, your name if you give it, and your language and currency.',
            'Purchases: what you bought, amounts, coupons, travel credit and GST invoices. You enter card and UPI details with Razorpay; we never see or store full card numbers.',
            'Your eSIM: its ICCID, activation code, data used and validity dates, which we get from our eSIM suppliers.',
            'Your device: push notification and Live Activity tokens, the app version and your device language.',
            'Support: the messages you send us.',
            'Security logs: IP addresses and request logs, kept for up to 30 days.',
          ],
          'We do not collect your location, contacts or browsing history. We do not sell personal data or use it for advertising.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          [
            'To issue and top up your eSIMs and show your usage.',
            'To take payments, give refunds and issue tax invoices.',
            'To send the notices you can expect: eSIM ready, low data, data used up and plan ending. You can turn notifications off in your phone’s settings.',
            'To answer support requests and run the referral programme.',
            'To prevent fraud, keep the service secure and meet legal duties such as tax records.',
          ],
          'We rely on your consent, on providing the service you asked for, and on our legal obligations.',
        ],
      },
      {
        heading: 'Who we share it with',
        body: [
          'We share only what each service needs to do its job for us:',
          [
            'Payments: Razorpay.',
            'eSIM supply: eSIM Access and eSIM Go receive order references and eSIM identifiers, not your name or contact details.',
            'Sign-in codes by SMS: MSG91 (India) and Twilio (other countries).',
            'Sign-in: Apple and Google, if you choose them.',
            'Notifications: Apple Push Notification service and Google Firebase Cloud Messaging.',
            'Support chat: Chatwoot. Error monitoring: Sentry.',
            'Hosting and encrypted backups: our cloud providers.',
            'Professional advisers, and authorities when the law requires it.',
          ],
          'Some of these providers store data outside India or the EU. We use providers that protect it with contracts and recognised safeguards.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          [
            'Account data: until you delete your account.',
            'Orders and invoices: as long as tax law requires (in India, at least six years after the end of the financial year), kept without your other account details after you delete your account.',
            'Support messages: two years. Security logs and backups: 30 days.',
          ],
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can ask to see, correct or delete your personal data, withdraw consent and nominate someone to act for you. You can delete your account any time in the app under Profile › Delete account. To use any other right, write to {officerEmail}.',
          'If you are not satisfied with our answer, you can complain to the Data Protection Board of India or, in the EU, to your local data protection authority.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'Data is encrypted in transit. eSIM activation codes are encrypted in our database, backups are encrypted, and every staff action on customer orders is logged.',
        ],
      },
      { heading: 'Children', body: ['vela is for people aged 18 and over. We do not knowingly collect data from anyone younger.'] },
      {
        heading: 'Changes',
        body: [
          'We will update this page when our practices change and tell you in the app or by email before significant changes take effect.',
        ],
      },
      {
        heading: 'Contact and grievance officer',
        body: [
          '{entity}, {address}. Grievance officer: {officer}, {officerEmail}. We aim to reply within 7 days and resolve complaints within 30 days.',
        ],
      },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    description: 'ما البيانات الشخصية التي تجمعها vela، ولماذا، ومع من نشاركها، وكيف تتحكم بها.',
    updated: 'آخر تحديث: 23 نوفمبر 2026',
    intro:
      'تبيع {entity} ‏("vela" أو "نحن") باقات بيانات شرائح eSIM للسفر عبر تطبيق vela وموقعها. توضح هذه السياسة البيانات الشخصية التي نجمعها، ولماذا، ومع من نشاركها، والخيارات المتاحة لك. نحن مسؤولون عن بياناتك بموجب قانون حماية البيانات الشخصية الرقمية في الهند لعام 2023، وبموجب اللائحة العامة لحماية البيانات للعملاء في الاتحاد الأوروبي.',
    sections: [
      {
        heading: 'ما الذي نجمعه',
        body: [
          [
            'الحساب: رقم هاتفك أو البريد الإلكتروني من تسجيل الدخول عبر Apple أو Google، واسمك إن قدّمته، ولغتك وعملتك.',
            'المشتريات: ما اشتريته، والمبالغ، والقسائم، ورصيد السفر، والفواتير الضريبية. تُدخل بيانات البطاقة وUPI لدى Razorpay، ولا نرى أرقام البطاقات كاملة ولا نخزنها.',
            'شريحتك: رقم ICCID ورمز التفعيل والبيانات المستخدمة وتواريخ الصلاحية، ونحصل عليها من مزودي الشرائح.',
            'جهازك: رموز الإشعارات والأنشطة المباشرة، وإصدار التطبيق، ولغة جهازك.',
            'الدعم: الرسائل التي ترسلها إلينا.',
            'سجلات الأمان: عناوين IP وسجلات الطلبات، ونحتفظ بها مدة أقصاها 30 يومًا.',
          ],
          'لا نجمع موقعك أو جهات اتصالك أو سجل تصفحك. لا نبيع البيانات الشخصية ولا نستخدمها للإعلانات.',
        ],
      },
      {
        heading: 'لماذا نستخدمها',
        body: [
          [
            'لإصدار شرائحك وشحنها وعرض استهلاكك.',
            'لتحصيل المدفوعات وردّ المبالغ وإصدار الفواتير الضريبية.',
            'لإرسال التنبيهات المتوقعة: جاهزية الشريحة، وانخفاض البيانات، ونفادها، واقتراب انتهاء الباقة. يمكنك إيقاف الإشعارات من إعدادات هاتفك.',
            'للرد على طلبات الدعم وتشغيل برنامج الإحالة.',
            'لمنع الاحتيال وحماية الخدمة والوفاء بالتزاماتنا القانونية مثل السجلات الضريبية.',
          ],
          'نعتمد على موافقتك، وعلى تقديم الخدمة التي طلبتها، وعلى التزاماتنا القانونية.',
        ],
      },
      {
        heading: 'مع من نشاركها',
        body: [
          'نشارك فقط ما تحتاجه كل خدمة لأداء عملها لصالحنا:',
          [
            'المدفوعات: Razorpay.',
            'توفير الشرائح: تتلقى eSIM Access وeSIM Go أرقام الطلبات ومعرّفات الشرائح فقط، لا اسمك ولا بيانات تواصلك.',
            'رموز الدخول عبر الرسائل النصية: MSG91 في الهند وTwilio في الدول الأخرى.',
            'تسجيل الدخول: Apple وGoogle إن اخترتهما.',
            'الإشعارات: خدمة إشعارات Apple وخدمة Firebase من Google.',
            'محادثة الدعم: Chatwoot. مراقبة الأخطاء: Sentry.',
            'الاستضافة والنسخ الاحتياطية المشفّرة: مزودو الخدمات السحابية لدينا.',
            'المستشارون المهنيون، والجهات الرسمية عندما يفرض القانون ذلك.',
          ],
          'يخزن بعض هؤلاء المزودين البيانات خارج الهند أو الاتحاد الأوروبي، ونختار مزودين يحمونها بعقود وضمانات معترف بها.',
        ],
      },
      {
        heading: 'مدة الاحتفاظ',
        body: [
          [
            'بيانات الحساب: حتى تحذف حسابك.',
            'الطلبات والفواتير: المدة التي يفرضها قانون الضرائب (في الهند ست سنوات على الأقل بعد نهاية السنة المالية)، ونحتفظ بها دون بقية بيانات حسابك بعد حذفه.',
            'رسائل الدعم: سنتان. سجلات الأمان والنسخ الاحتياطية: 30 يومًا.',
          ],
        ],
      },
      {
        heading: 'حقوقك',
        body: [
          'يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها، وسحب موافقتك، وتعيين من ينوب عنك. يمكنك حذف حسابك في أي وقت من التطبيق: الملف الشخصي › حذف الحساب. ولممارسة أي حق آخر راسل {officerEmail}.',
          'إن لم يُرضِك ردّنا، يمكنك تقديم شكوى إلى مجلس حماية البيانات في الهند، أو إلى هيئة حماية البيانات في بلدك داخل الاتحاد الأوروبي.',
        ],
      },
      {
        heading: 'الأمان',
        body: [
          'تُشفَّر البيانات أثناء نقلها، وتُشفَّر رموز تفعيل الشرائح في قاعدة بياناتنا، وتُشفَّر النسخ الاحتياطية، وتُسجَّل كل إجراءات الموظفين على طلبات العملاء.',
        ],
      },
      { heading: 'الأطفال', body: ['خدمة vela مخصصة لمن بلغوا 18 عامًا فأكثر، ولا نجمع عن قصد بيانات من هم أصغر سنًا.'] },
      { heading: 'التغييرات', body: ['سنحدّث هذه الصفحة عند تغيّر ممارساتنا، ونبلغك في التطبيق أو بالبريد قبل سريان أي تغيير جوهري.'] },
      {
        heading: 'التواصل ومسؤول التظلمات',
        body: ['{entity}، {address}. مسؤول التظلمات: {officer}، {officerEmail}. نسعى إلى الرد خلال 7 أيام وحل الشكاوى خلال 30 يومًا.'],
      },
    ],
  },
};

const terms: Record<Locale, LegalDoc> = {
  en: {
    title: 'terms of service',
    description: 'The terms for buying and using vela travel eSIMs.',
    updated: 'Last updated 23 November 2026',
    intro:
      'These terms are an agreement between you and {entity} ("vela", "we"). By creating an account or buying a plan, you agree to them.',
    sections: [
      {
        heading: 'Who can use vela',
        body: ['You must be 18 or over and use a phone that supports eSIM and is not locked to a carrier.'],
      },
      {
        heading: 'What you buy',
        body: [
          'Each plan is a data-only eSIM for the countries, data amount and validity shown before you pay. It does not include a phone number or calls unless the plan says so.',
          'Speed and coverage depend on our partner networks in each country. We list the networks for every destination but cannot guarantee coverage everywhere.',
        ],
      },
      {
        heading: 'Prices and payment',
        body: [
          'Prices are shown in your currency. Rupee prices include 18% GST. Payments are processed by Razorpay.',
          'One coupon can be used per order. Travel credit is applied at checkout automatically, has no cash value and cannot be transferred.',
        ],
      },
      {
        heading: 'Delivery and activation',
        body: [
          'We issue your eSIM after payment, usually within a minute. Install it while connected to Wi-Fi. Validity starts when the eSIM first connects to a network, or when it is installed if the plan says so.',
          'An installed eSIM usually cannot be moved to another phone, so install it on the phone you will travel with.',
        ],
      },
      {
        heading: 'Refunds',
        body: [
          [
            'If we cannot issue your eSIM, we refund you in full automatically.',
            'If you have not installed the eSIM, contact us within 30 days of purchase for a full refund.',
            'After installation, we refund only if the eSIM does not work because of a fault on our side or our partner’s that we cannot fix.',
            'We do not refund unused data or unused days. Top-ups follow the same rules.',
          ],
          'Refunds go back to the original payment method and can take 5-7 working days to arrive.',
        ],
      },
      {
        heading: 'Fair use',
        body: [
          'Do not use vela for anything illegal, resell plans, or use the service in ways that harm the networks or other customers. We may suspend eSIMs or accounts that break these terms.',
        ],
      },
      {
        heading: 'Referrals',
        body: [
          'A friend who uses your code gets a discount on their first eSIM. You receive travel credit when their eSIM first connects. We may withhold credit gained through abuse and may change or end the programme.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'Keep your sign-in secure. You can delete your account in the app at any time; eSIMs already installed keep working until they end.',
        ],
      },
      {
        heading: 'Liability',
        body: [
          'To the extent the law allows, we are not liable for indirect losses, such as missed connections or business losses, and our total liability for a plan is limited to what you paid for it. Nothing in these terms removes rights you have under consumer protection law.',
        ],
      },
      {
        heading: 'Changes',
        body: ['We may update the service and these terms. We will tell you about significant changes before they apply to new purchases.'],
      },
      {
        heading: 'Law and disputes',
        body: [
          'These terms are governed by the laws of India, and the courts of {city} have jurisdiction. If you live in the European Union, you also keep the protection of your local consumer law.',
        ],
      },
      { heading: 'Contact', body: ['{entity}, {address}. Email {email}.'] },
    ],
  },
  ar: {
    title: 'شروط الخدمة',
    description: 'شروط شراء شرائح vela للسفر واستخدامها.',
    updated: 'آخر تحديث: 23 نوفمبر 2026',
    intro: 'هذه الشروط اتفاق بينك وبين {entity} ‏("vela" أو "نحن"). بإنشاء حساب أو شراء باقة فإنك توافق عليها.',
    sections: [
      {
        heading: 'من يمكنه استخدام vela',
        body: ['يجب أن يكون عمرك 18 عامًا فأكثر، وأن تستخدم هاتفًا يدعم الشرائح الإلكترونية وغير مقفل على شركة اتصالات.'],
      },
      {
        heading: 'ما الذي تشتريه',
        body: [
          'كل باقة شريحة بيانات فقط للدول وحجم البيانات ومدة الصلاحية المعروضة قبل الدفع، ولا تشمل رقم هاتف أو مكالمات ما لم تذكر الباقة ذلك.',
          'تعتمد السرعة والتغطية على الشبكات الشريكة في كل دولة. نعرض الشبكات لكل وجهة، لكن لا يمكننا ضمان التغطية في كل مكان.',
        ],
      },
      {
        heading: 'الأسعار والدفع',
        body: [
          'تُعرض الأسعار بعملتك، وتشمل الأسعار بالروبية ضريبة السلع والخدمات بنسبة 18%. تُعالج المدفوعات عبر Razorpay.',
          'يمكن استخدام قسيمة واحدة لكل طلب. يُطبَّق رصيد السفر تلقائيًا عند الدفع، وليست له قيمة نقدية ولا يمكن تحويله.',
        ],
      },
      {
        heading: 'التسليم والتفعيل',
        body: [
          'نصدر شريحتك بعد الدفع، عادةً خلال دقيقة. ثبّتها وأنت متصل بشبكة Wi-Fi. تبدأ الصلاحية عند أول اتصال للشريحة بشبكة، أو عند تثبيتها إذا نصّت الباقة على ذلك.',
          'لا يمكن عادةً نقل الشريحة المثبتة إلى هاتف آخر، لذا ثبّتها على الهاتف الذي ستسافر به.',
        ],
      },
      {
        heading: 'استرداد المبالغ',
        body: [
          [
            'إن تعذّر علينا إصدار شريحتك، نعيد إليك المبلغ كاملًا تلقائيًا.',
            'إن لم تثبّت الشريحة، تواصل معنا خلال 30 يومًا من الشراء لاسترداد المبلغ كاملًا.',
            'بعد التثبيت، نعيد المبلغ فقط إذا لم تعمل الشريحة بسبب خلل من جهتنا أو من جهة شريكنا لا يمكننا إصلاحه.',
            'لا نعيد قيمة البيانات أو الأيام غير المستخدمة. وتخضع عمليات الشحن للقواعد نفسها.',
          ],
          'تُعاد المبالغ إلى وسيلة الدفع الأصلية، وقد يستغرق وصولها من 5 إلى 7 أيام عمل.',
        ],
      },
      {
        heading: 'الاستخدام العادل',
        body: [
          'لا تستخدم vela لأي غرض غير قانوني، ولا تُعِد بيع الباقات، ولا تستخدم الخدمة بطريقة تضر بالشبكات أو بالعملاء الآخرين. قد نوقف الشرائح أو الحسابات التي تخالف هذه الشروط.',
        ],
      },
      {
        heading: 'الإحالات',
        body: [
          'يحصل الصديق الذي يستخدم رمزك على خصم على أول شريحة له، وتحصل أنت على رصيد سفر عند أول اتصال لشريحته. قد نحجب الرصيد المكتسب بطرق مسيئة، وقد نغيّر البرنامج أو ننهيه.',
        ],
      },
      {
        heading: 'حسابك',
        body: ['حافظ على أمان وسيلة دخولك. يمكنك حذف حسابك من التطبيق في أي وقت، وتبقى الشرائح المثبتة تعمل حتى تنتهي.'],
      },
      {
        heading: 'المسؤولية',
        body: [
          'في الحدود التي يسمح بها القانون، لا نتحمل مسؤولية الخسائر غير المباشرة مثل فوات الرحلات أو الخسائر التجارية، وتقتصر مسؤوليتنا الكاملة عن أي باقة على ما دفعته مقابلها. لا يلغي أي شيء في هذه الشروط حقوقك بموجب قوانين حماية المستهلك.',
        ],
      },
      { heading: 'التغييرات', body: ['قد نحدّث الخدمة وهذه الشروط، وسنبلغك بالتغييرات الجوهرية قبل تطبيقها على المشتريات الجديدة.'] },
      {
        heading: 'القانون والنزاعات',
        body: [
          'تخضع هذه الشروط لقوانين الهند، وتختص بها محاكم {city}. إن كنت مقيمًا في الاتحاد الأوروبي، تبقى لك حماية قانون المستهلك في بلدك.',
        ],
      },
      { heading: 'التواصل', body: ['{entity}، {address}. البريد الإلكتروني {email}.'] },
    ],
  },
};

const refunds: Record<Locale, LegalDoc> = {
  en: {
    title: 'refunds and cancellations',
    description: 'When vela refunds an eSIM or top-up, how to ask for one and how long it takes.',
    updated: 'Last updated 25 November 2026',
    intro:
      'This policy explains when {entity} ("vela", "we") refunds eSIMs and top-ups, and how to cancel an order. It is part of our Terms of Service and does not remove rights you have under consumer protection law.',
    sections: [
      {
        heading: 'When we refund',
        body: [
          [
            'If we cannot issue your eSIM or add your top-up, we refund you in full automatically. You do not need to contact us.',
            'If you have not installed the eSIM, you can ask for a full refund within 30 days of purchase. We cancel the eSIM with our partner when we refund it.',
            'After installation, we refund only if the eSIM does not work because of a fault on our side or our partner’s that we cannot fix.',
            'If you were charged twice for the same order, we refund the extra payment.',
          ],
        ],
      },
      {
        heading: 'When we do not refund',
        body: [
          [
            'Unused data or unused days on an eSIM that has been installed or has connected to a network.',
            'An eSIM installed on a phone that does not support eSIM or is locked to a carrier. Check your phone before you buy.',
            'Coverage or speed limits of a partner network that are listed on the destination page.',
            'An eSIM that was deleted from the phone after installation. It usually cannot be installed again.',
          ],
          'Top-ups follow the same rules as eSIMs.',
        ],
      },
      {
        heading: 'Cancelling an order',
        body: [
          'An order that has not been paid is cancelled automatically after 30 minutes. Once an eSIM has been issued, cancelling it is a refund request and follows the rules above.',
        ],
      },
      {
        heading: 'How to ask for a refund',
        body: [
          'Open Support chat in the vela app, or email {email} with your order number and the email or phone number on your account. We reply within one working day.',
        ],
      },
      {
        heading: 'How refunds are paid',
        body: [
          [
            'Refunds go back to the original payment method. Banks and card issuers usually take 5-7 working days to show them.',
            'Any travel credit used on the order is returned to your vela balance.',
            'For rupee orders we issue a credit note against your GST invoice.',
          ],
        ],
      },
      { heading: 'Contact', body: ['{entity}, {address}. Email {email}.'] },
    ],
  },
  ar: {
    title: 'الاسترداد والإلغاء',
    description: 'متى تسترد vela قيمة شريحة eSIM أو الشحن، وكيف تطلب ذلك، وكم يستغرق.',
    updated: 'آخر تحديث: 25 نوفمبر 2026',
    intro:
      'توضح هذه السياسة متى تسترد {entity} ‏("vela"، "نحن") قيمة شرائح eSIM وعمليات الشحن، وكيف تلغي طلباً. وهي جزء من شروط الخدمة، ولا تُسقط أي حقوق تمنحها لك قوانين حماية المستهلك.',
    sections: [
      {
        heading: 'متى نسترد المبلغ',
        body: [
          [
            'إذا لم نتمكن من إصدار شريحتك أو إضافة الشحن، نسترد لك المبلغ كاملاً تلقائياً دون الحاجة إلى التواصل معنا.',
            'إذا لم تثبّت الشريحة بعد، يمكنك طلب استرداد كامل خلال 30 يوماً من الشراء، ونلغي الشريحة لدى شريكنا عند الاسترداد.',
            'بعد التثبيت، نسترد المبلغ فقط إذا لم تعمل الشريحة بسبب خلل من جهتنا أو من جهة شريكنا لا يمكن إصلاحه.',
            'إذا دُفع الطلب نفسه مرتين، نسترد الدفعة الزائدة.',
          ],
        ],
      },
      {
        heading: 'متى لا نسترد المبلغ',
        body: [
          [
            'البيانات أو الأيام غير المستخدمة في شريحة ثُبّتت أو اتصلت بشبكة.',
            'شريحة ثُبّتت على هاتف لا يدعم eSIM أو مقفل على مشغّل. تحقق من هاتفك قبل الشراء.',
            'حدود التغطية أو السرعة لدى شبكة الشريك المذكورة في صفحة الوجهة.',
            'شريحة حُذفت من الهاتف بعد تثبيتها، إذ لا يمكن عادةً تثبيتها مرة أخرى.',
          ],
          'تخضع عمليات الشحن للقواعد نفسها.',
        ],
      },
      {
        heading: 'إلغاء الطلب',
        body: ['يُلغى الطلب غير المدفوع تلقائياً بعد 30 دقيقة. وبعد إصدار الشريحة يُعدّ الإلغاء طلب استرداد ويخضع للقواعد أعلاه.'],
      },
      {
        heading: 'كيف تطلب الاسترداد',
        body: [
          'افتح محادثة الدعم في تطبيق vela، أو راسلنا على {email} مع رقم الطلب والبريد أو رقم الهاتف المسجّل في حسابك. نرد خلال يوم عمل واحد.',
        ],
      },
      {
        heading: 'كيف يُدفع المبلغ المسترد',
        body: [
          [
            'يعود المبلغ إلى وسيلة الدفع الأصلية، وعادةً يظهر خلال 5-7 أيام عمل حسب البنك.',
            'يعود أي رصيد سفر استُخدم في الطلب إلى رصيدك في vela.',
            'للطلبات بالروبية نصدر إشعاراً دائناً مقابل فاتورة ضريبة السلع والخدمات.',
          ],
        ],
      },
      { heading: 'التواصل', body: ['{entity}، {address}. البريد الإلكتروني {email}.'] },
    ],
  },
};

const delivery: Record<Locale, LegalDoc> = {
  en: {
    title: 'esim delivery',
    description: 'How and when vela delivers your eSIM, and where to find it.',
    updated: 'Last updated 25 November 2026',
    intro:
      'vela sells digital eSIM data plans. Nothing is shipped: your eSIM is delivered electronically. This policy explains how and when.',
    sections: [
      {
        heading: 'When you get it',
        body: [
          'We issue your eSIM as soon as your payment is confirmed, usually within a minute. If it has not arrived after 30 minutes, contact us. If we cannot issue it, we refund you in full automatically.',
        ],
      },
      {
        heading: 'Where to find it',
        body: [
          [
            'In the vela app under My eSIMs, with a one-tap Install button.',
            'On the website’s order page and in your account, with a QR code and manual install codes.',
            'By email, if you gave us an email address, with your receipt.',
          ],
        ],
      },
      {
        heading: 'Installing and starting',
        body: [
          'Install the eSIM while you are connected to Wi-Fi, ideally before you travel. Most plans start when your phone first connects to a network at your destination; the plan page says if a plan starts at installation instead.',
        ],
      },
      {
        heading: 'Where it works',
        body: ['Each plan works in the countries listed on its destination page, on the partner networks listed there.'],
      },
      {
        heading: 'Top-ups',
        body: ['Top-ups are added to your existing eSIM as soon as payment is confirmed. There is nothing to install again.'],
      },
      { heading: 'Contact', body: ['{entity}, {address}. Email {email}.'] },
    ],
  },
  ar: {
    title: 'تسليم شريحة eSIM',
    description: 'كيف ومتى تسلّم vela شريحتك، وأين تجدها.',
    updated: 'آخر تحديث: 25 نوفمبر 2026',
    intro: 'تبيع vela باقات بيانات رقمية بشرائح eSIM. لا يُشحن أي شيء، إذ تُسلَّم الشريحة إلكترونياً. توضح هذه السياسة كيف ومتى.',
    sections: [
      {
        heading: 'متى تصلك',
        body: [
          'نصدر شريحتك فور تأكيد الدفع، وعادةً خلال دقيقة. إذا لم تصل بعد 30 دقيقة فتواصل معنا. وإذا تعذّر إصدارها نسترد لك المبلغ كاملاً تلقائياً.',
        ],
      },
      {
        heading: 'أين تجدها',
        body: [
          [
            'في تطبيق vela ضمن شرائحي، مع زر تثبيت بلمسة واحدة.',
            'في صفحة الطلب على الموقع وفي حسابك، مع رمز QR ورموز التثبيت اليدوي.',
            'عبر البريد الإلكتروني مع الإيصال، إذا زوّدتنا ببريدك.',
          ],
        ],
      },
      {
        heading: 'التثبيت وبدء الباقة',
        body: [
          'ثبّت الشريحة وأنت متصل بشبكة Wi-Fi، ويفضّل قبل السفر. تبدأ معظم الباقات عند أول اتصال لهاتفك بشبكة في وجهتك، وتوضح صفحة الباقة إن كانت تبدأ عند التثبيت.',
        ],
      },
      {
        heading: 'أين تعمل',
        body: ['تعمل كل باقة في الدول المذكورة في صفحة وجهتها، وعلى شبكات الشركاء المذكورة هناك.'],
      },
      { heading: 'الشحن', body: ['يُضاف الشحن إلى شريحتك الحالية فور تأكيد الدفع، دون الحاجة إلى إعادة التثبيت.'] },
      { heading: 'التواصل', body: ['{entity}، {address}. البريد الإلكتروني {email}.'] },
    ],
  },
};

const cookies: Record<Locale, LegalDoc> = {
  en: {
    title: 'cookies',
    description: 'What the vela website stores in your browser and why.',
    updated: 'Last updated 25 November 2026',
    intro:
      'The vela website uses a small amount of browser storage to work. We do not use advertising or analytics cookies, and we do not track you across other sites, so there is nothing to opt in to.',
    sections: [
      {
        heading: 'What we store',
        body: [
          [
            'Your currency choice, so prices stay in the currency you picked (local storage).',
            'Your recent orders during a visit, so the order page can show your eSIM after payment (session storage, cleared when you close the tab).',
            'A sign-in cookie when you sign in to your account, so you stay signed in.',
          ],
        ],
      },
      {
        heading: 'Payments',
        body: [
          'When you pay, Razorpay’s checkout may set its own cookies to process the payment and prevent fraud. Razorpay’s privacy policy covers these.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'You can clear or block browser storage in your browser settings. If you block it, you will need to choose your currency again and may be signed out.',
        ],
      },
      { heading: 'Contact', body: ['Questions about this policy: {email}.'] },
    ],
  },
  ar: {
    title: 'ملفات تعريف الارتباط',
    description: 'ما يخزّنه موقع vela في متصفحك ولماذا.',
    updated: 'آخر تحديث: 25 نوفمبر 2026',
    intro:
      'يستخدم موقع vela قدراً صغيراً من تخزين المتصفح ليعمل. لا نستخدم ملفات تعريف ارتباط للإعلانات أو التحليلات، ولا نتتبعك عبر مواقع أخرى، لذا لا يوجد ما توافق عليه.',
    sections: [
      {
        heading: 'ما نخزّنه',
        body: [
          [
            'العملة التي اخترتها، لتبقى الأسعار بها (التخزين المحلي).',
            'طلباتك الأخيرة خلال الزيارة، لتعرض صفحة الطلب شريحتك بعد الدفع (تخزين الجلسة، ويُمسح عند إغلاق التبويب).',
            'ملف تعريف ارتباط لتسجيل الدخول عند دخولك إلى حسابك، لتبقى مسجّلاً.',
          ],
        ],
      },
      {
        heading: 'المدفوعات',
        body: [
          'عند الدفع، قد تضع صفحة الدفع من Razorpay ملفات تعريف ارتباط خاصة بها لمعالجة الدفع ومنع الاحتيال، وتغطيها سياسة الخصوصية لدى Razorpay.',
        ],
      },
      {
        heading: 'خياراتك',
        body: ['يمكنك مسح تخزين المتصفح أو حظره من إعدادات المتصفح. إذا حظرته فستحتاج إلى اختيار عملتك مجدداً وقد يُسجَّل خروجك.'],
      },
      { heading: 'التواصل', body: ['للأسئلة حول هذه السياسة: {email}.'] },
    ],
  },
};

const contact: Record<Locale, LegalDoc> = {
  en: {
    title: 'contact us',
    description: 'How to reach vela support, our registered address and our grievance officer.',
    updated: 'Last updated 25 November 2026',
    intro: 'The fastest way to reach us is Support chat in the vela app. You can also email us.',
    sections: [
      {
        heading: 'Support',
        body: [
          ['Support chat in the vela app, under Profile › Support.', 'Email: {email}. We reply within one working day.'],
          'For an order, include your order number and the email or phone number on your account.',
        ],
      },
      { heading: 'Company', body: ['{entity}', '{address}'] },
      {
        heading: 'Grievance officer',
        body: [
          'Under India’s Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023, you can raise a complaint with our grievance officer.',
          ['{officer}', 'Email: {officerEmail}'],
          'We acknowledge complaints within 48 hours and resolve them within one month.',
        ],
      },
    ],
  },
  ar: {
    title: 'تواصل معنا',
    description: 'كيف تتواصل مع دعم vela، وعنواننا المسجّل، ومسؤول التظلمات.',
    updated: 'آخر تحديث: 25 نوفمبر 2026',
    intro: 'أسرع طريقة للتواصل معنا هي محادثة الدعم في تطبيق vela، ويمكنك أيضاً مراسلتنا بالبريد الإلكتروني.',
    sections: [
      {
        heading: 'الدعم',
        body: [
          ['محادثة الدعم في تطبيق vela، ضمن الملف الشخصي › الدعم.', 'البريد الإلكتروني: {email}. نرد خلال يوم عمل واحد.'],
          'إذا كان استفسارك عن طلب، فأرفق رقم الطلب والبريد أو رقم الهاتف المسجّل في حسابك.',
        ],
      },
      { heading: 'الشركة', body: ['{entity}', '{address}'] },
      {
        heading: 'مسؤول التظلمات',
        body: [
          'وفقاً لقواعد حماية المستهلك (التجارة الإلكترونية) لعام 2020 وقانون حماية البيانات الشخصية الرقمية لعام 2023 في الهند، يمكنك تقديم شكوى إلى مسؤول التظلمات لدينا.',
          ['{officer}', 'البريد الإلكتروني: {officerEmail}'],
          'نؤكد استلام الشكاوى خلال 48 ساعة ونحلّها خلال شهر واحد.',
        ],
      },
    ],
  },
};

export const privacyFor = (locale: Locale) => filled(privacy[locale]);
export const termsFor = (locale: Locale) => filled(terms[locale]);
export const refundsFor = (locale: Locale) => filled(refunds[locale]);
export const deliveryFor = (locale: Locale) => filled(delivery[locale]);
export const cookiesFor = (locale: Locale) => filled(cookies[locale]);
export const contactFor = (locale: Locale) => filled(contact[locale]);

/** Every legal page, in footer order. */
export const legalPages = ['terms', 'privacy', 'refunds', 'delivery', 'cookies', 'contact'] as const;
export type LegalPageSlug = (typeof legalPages)[number];

export function legalDocFor(slug: LegalPageSlug, locale: Locale): LegalDoc {
  const docs = { terms, privacy, refunds, delivery, cookies, contact };
  return filled(docs[slug][locale]);
}
