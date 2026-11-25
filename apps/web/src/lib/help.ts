import type { Locale } from './i18n';

export type Qa = { q: string; a: string };
export type FaqGroup = { id: string; title: string; items: Qa[] };

export type GuideStep = { title: string; body: string };
export type Guide = { id: string; title: string; intro?: string; steps?: GuideStep[]; points?: string[] };

export type HelpContent = {
  faq: { title: string; description: string; intro: string; groups: FaqGroup[] };
  help: { title: string; description: string; intro: string; guides: Guide[] };
  stillStuck: { title: string; body: string };
};

// Answers mirror the app's help centre and compatibility guide so the two never disagree.
const content: Record<Locale, HelpContent> = {
  en: {
    faq: {
      title: 'questions, answered.',
      description: 'Answers about buying, installing and using a vela travel eSIM.',
      intro: 'Everything people ask before and after they fly. If your question is not here, Support chat in the app is one tap away.',
      groups: [
        {
          id: 'before',
          title: 'Before you buy',
          items: [
            {
              q: 'Does my phone support eSIM?',
              a: 'Dial *#06#. If you see an EID number, it does. Most iPhones from the XS onwards and recent Pixel, Samsung and other Android phones support eSIM. The phone must also be unlocked from its carrier.',
            },
            {
              q: 'Do I get a phone number?',
              a: 'No. vela plans are data only. Use WhatsApp, FaceTime or similar apps for calls, and keep your home number active on your other line.',
            },
            {
              q: 'Can I share data with a hotspot?',
              a: 'Most plans allow it. The destination page shows Hotspot on every plan that supports it.',
            },
            {
              q: 'Which currencies can I pay in?',
              a: 'Rupees, with 18% GST included, plus AED, SAR, EUR and USD. Payments are processed by Razorpay.',
            },
          ],
        },
        {
          id: 'install',
          title: 'Installing',
          items: [
            {
              q: 'How do I install my eSIM?',
              a: 'Open your eSIM in the app and tap Install on this phone. On another phone, scan the QR code under Settings › Mobile › Add eSIM. Install it before you fly while you have Wi-Fi.',
            },
            {
              q: 'When does my plan start?',
              a: 'Most plans start when your phone first connects to a network at your destination. The plan page says if a plan starts when you install it instead.',
            },
            {
              q: 'Can I move my eSIM to a new phone?',
              a: 'Usually not. An installed eSIM stays on the phone it was installed on, so install it on the phone you will travel with.',
            },
          ],
        },
        {
          id: 'abroad',
          title: 'Using it abroad',
          items: [
            {
              q: 'How do I turn it on when I land?',
              a: 'Turn on the vela line in Settings › Mobile and switch on data roaming for it. Keep your home SIM for calls and texts if you like.',
            },
            {
              q: 'Will my home carrier charge me roaming?',
              a: 'Not for data, if you set the vela line as your mobile data line and turn off data roaming on your home SIM. Calls and texts on your home number are billed by your carrier as usual.',
            },
            {
              q: 'How much data do I have left?',
              a: 'Open the eSIM in the app to see what is left and your daily use. Figures can lag a couple of hours behind the network.',
            },
            {
              q: 'Can I add more data?',
              a: 'Yes. Tap Top up on the eSIM. The data, and any extra days, are added to the same eSIM, so there is nothing to reinstall.',
            },
          ],
        },
        {
          id: 'payments',
          title: 'Payments and refunds',
          items: [
            {
              q: 'Can I get a refund?',
              a: 'If you have not installed the eSIM, contact us within 30 days of purchase for a full refund. After installation we refund only if it does not work because of a fault on our side. If we cannot issue your eSIM, you are refunded automatically.',
            },
            {
              q: 'How long does a refund take?',
              a: 'Refunds go back to your original payment method and usually show within 5-7 working days, depending on your bank.',
            },
            {
              q: 'Do I get a GST invoice?',
              a: 'Yes. Every rupee order and top-up gets a GST invoice, available in the app under Orders and invoices.',
            },
          ],
        },
      ],
    },
    help: {
      title: 'help centre.',
      description: 'Install your vela eSIM, switch it on when you land and fix connection problems.',
      intro: 'Short guides for the moments that matter: before you fly, when you land and if something does not connect.',
      guides: [
        {
          id: 'install-iphone',
          title: 'Install on iPhone',
          intro: 'Do this before you fly, while you are on Wi-Fi.',
          steps: [
            {
              title: 'Open your eSIM',
              body: 'In the vela app, open My eSIMs and pick the eSIM. On the website, open your order or your account.',
            },
            { title: 'Tap Install on this phone', body: 'Or, on another device, scan the QR code from Settings › Mobile › Add eSIM.' },
            { title: 'Label the line', body: 'Name it “vela” so you can tell it apart from your home SIM.' },
            { title: 'Keep it off until you land', body: 'Leave the line on, but switch off data roaming for it until you arrive.' },
          ],
        },
        {
          id: 'install-android',
          title: 'Install on Android',
          intro: 'Menu names vary a little between brands.',
          steps: [
            { title: 'Open Settings', body: 'Go to Network & internet › SIMs, or Connections › SIM manager on Samsung.' },
            { title: 'Add eSIM', body: 'Choose Add eSIM or Download a SIM, then scan the QR code from your order.' },
            {
              title: 'Enter codes if asked',
              body: 'If scanning is not offered, enter the SM-DP+ address and activation code from your order.',
            },
            { title: 'Name the line', body: 'Call it “vela” and keep data roaming off until you land.' },
          ],
        },
        {
          id: 'landing',
          title: 'When you land',
          steps: [
            { title: 'Turn the vela line on', body: 'Settings › Mobile on iPhone, or SIMs on Android.' },
            { title: 'Switch on data roaming', body: 'For the vela line only. Your plan includes it; there is no extra charge.' },
            {
              title: 'Pick vela for mobile data',
              body: 'Set the vela line as the line for mobile data. Keep your home number for calls if you like.',
            },
          ],
        },
        {
          id: 'troubleshooting',
          title: 'Not connecting?',
          points: [
            'Check that data roaming is on for the vela line, and that it is the line chosen for mobile data.',
            'Turn airplane mode on for ten seconds, then off, to make your phone look for a network again.',
            'Restart your phone.',
            'In the line’s network settings, turn off automatic network selection and pick one of the partner networks listed on your destination page.',
            'Check the APN is set automatically. If your plan lists an APN, enter it under the line’s Mobile data network settings.',
            'Still nothing? Open Support chat in the app with your order number. We reply within one working day.',
          ],
        },
        {
          id: 'compatibility',
          title: 'Device compatibility',
          intro: 'vela works on phones that support eSIM and are not locked to a carrier.',
          points: [
            'Quick check: dial *#06#. If you see an EID number, your phone supports eSIM.',
            'iPhone XS, XS Max, XR and every newer model, including iPhone SE (2nd generation and later). iPhones bought in mainland China, Hong Kong or Macau may not support eSIM.',
            'Google Pixel 3 and later, Samsung Galaxy S20 and later, Z Flip and Z Fold, and recent models from Motorola, OnePlus, Xiaomi, OPPO and others.',
            'If your phone came from a carrier on contract, ask them to unlock it before you travel.',
          ],
        },
      ],
    },
    stillStuck: {
      title: 'Still stuck?',
      body: 'Open Support chat in the vela app, or email us. We reply within one working day.',
    },
  },
  ar: {
    faq: {
      title: 'إجابات أسئلتك.',
      description: 'إجابات عن شراء شريحة vela للسفر وتثبيتها واستخدامها.',
      intro: 'كل ما يُسأل عنه قبل السفر وبعده. إذا لم تجد سؤالك هنا، فمحادثة الدعم في التطبيق على بُعد لمسة.',
      groups: [
        {
          id: 'before',
          title: 'قبل الشراء',
          items: [
            {
              q: 'هل يدعم هاتفي eSIM؟',
              a: 'اطلب ‎*#06#‎. إذا ظهر رقم EID فهاتفك يدعمها. تدعمها معظم أجهزة iPhone بدءاً من XS وأحدث أجهزة Pixel وSamsung وغيرها من أجهزة Android. ويجب أن يكون الهاتف غير مقفل على مشغّل.',
            },
            {
              q: 'هل أحصل على رقم هاتف؟',
              a: 'لا. باقات vela للبيانات فقط. استخدم واتساب أو فيس تايم أو تطبيقات مشابهة للمكالمات، وأبقِ رقمك المحلي مفعّلاً على الخط الآخر.',
            },
            {
              q: 'هل يمكنني مشاركة البيانات عبر نقطة اتصال؟',
              a: 'تسمح بذلك معظم الباقات، وتظهر عبارة نقطة اتصال على كل باقة تدعمها في صفحة الوجهة.',
            },
            {
              q: 'بأي عملات يمكنني الدفع؟',
              a: 'بالروبية شاملة ضريبة السلع والخدمات 18%، وكذلك بالدرهم والريال واليورو والدولار. تتم المدفوعات عبر Razorpay.',
            },
          ],
        },
        {
          id: 'install',
          title: 'التثبيت',
          items: [
            {
              q: 'كيف أثبّت شريحتي؟',
              a: 'افتح الشريحة في التطبيق واضغط تثبيت على هذا الهاتف. على هاتف آخر، امسح رمز QR من الإعدادات › الخلوي › إضافة eSIM. ثبّتها قبل السفر وأنت متصل بشبكة Wi-Fi.',
            },
            {
              q: 'متى تبدأ باقتي؟',
              a: 'تبدأ معظم الباقات عند أول اتصال لهاتفك بشبكة في وجهتك، وتوضح صفحة الباقة إن كانت تبدأ عند التثبيت.',
            },
            {
              q: 'هل يمكنني نقل الشريحة إلى هاتف جديد؟',
              a: 'عادةً لا. تبقى الشريحة المثبّتة على الهاتف الذي ثُبّتت عليه، لذا ثبّتها على الهاتف الذي ستسافر به.',
            },
          ],
        },
        {
          id: 'abroad',
          title: 'الاستخدام في الخارج',
          items: [
            {
              q: 'كيف أفعّلها عند الوصول؟',
              a: 'فعّل خط vela من الإعدادات › الخلوي وشغّل تجوال البيانات له. ويمكنك إبقاء شريحتك المحلية للمكالمات والرسائل.',
            },
            {
              q: 'هل سيحاسبني مشغّلي المحلي على التجوال؟',
              a: 'ليس على البيانات، إذا جعلت خط vela خط البيانات وأوقفت تجوال البيانات على شريحتك المحلية. أما المكالمات والرسائل على رقمك المحلي فيحاسبك عليها مشغّلك كالمعتاد.',
            },
            {
              q: 'كم تبقّى من بياناتي؟',
              a: 'افتح الشريحة في التطبيق لترى المتبقي واستخدامك اليومي. قد تتأخر الأرقام ساعتين تقريباً عن الشبكة.',
            },
            {
              q: 'هل يمكنني إضافة بيانات؟',
              a: 'نعم. اضغط شحن على الشريحة، وتُضاف البيانات وأي أيام إضافية إلى الشريحة نفسها دون إعادة تثبيت.',
            },
          ],
        },
        {
          id: 'payments',
          title: 'الدفع والاسترداد',
          items: [
            {
              q: 'هل يمكنني استرداد المبلغ؟',
              a: 'إذا لم تثبّت الشريحة، تواصل معنا خلال 30 يوماً من الشراء لاسترداد كامل. بعد التثبيت نسترد المبلغ فقط إذا لم تعمل بسبب خلل من جهتنا. وإذا تعذّر إصدار الشريحة نسترد المبلغ تلقائياً.',
            },
            { q: 'كم يستغرق الاسترداد؟', a: 'يعود المبلغ إلى وسيلة الدفع الأصلية، وعادةً يظهر خلال 5-7 أيام عمل حسب البنك.' },
            {
              q: 'هل أحصل على فاتورة ضريبية؟',
              a: 'نعم. يحصل كل طلب وشحن بالروبية على فاتورة ضريبة السلع والخدمات، وتجدها في التطبيق ضمن الطلبات والفواتير.',
            },
          ],
        },
      ],
    },
    help: {
      title: 'مركز المساعدة.',
      description: 'ثبّت شريحة vela، وفعّلها عند الوصول، وحلّ مشكلات الاتصال.',
      intro: 'أدلة قصيرة للحظات المهمة: قبل السفر، وعند الوصول، وإذا لم يتم الاتصال.',
      guides: [
        {
          id: 'install-iphone',
          title: 'التثبيت على iPhone',
          intro: 'قم بذلك قبل السفر وأنت متصل بشبكة Wi-Fi.',
          steps: [
            { title: 'افتح شريحتك', body: 'في تطبيق vela افتح شرائحي واختر الشريحة. وعلى الموقع افتح طلبك أو حسابك.' },
            { title: 'اضغط تثبيت على هذا الهاتف', body: 'أو امسح رمز QR من جهاز آخر عبر الإعدادات › الخلوي › إضافة eSIM.' },
            { title: 'سمِّ الخط', body: 'سمّه «vela» لتميّزه عن شريحتك المحلية.' },
            { title: 'أبقِ التجوال مغلقاً حتى الوصول', body: 'اترك الخط مفعّلاً، لكن أوقف تجوال البيانات له حتى تصل.' },
          ],
        },
        {
          id: 'install-android',
          title: 'التثبيت على Android',
          intro: 'تختلف أسماء القوائم قليلاً بين الشركات.',
          steps: [
            { title: 'افتح الإعدادات', body: 'انتقل إلى الشبكة والإنترنت › شرائح SIM، أو الاتصالات › مدير SIM في Samsung.' },
            { title: 'أضف eSIM', body: 'اختر إضافة eSIM أو تنزيل شريحة، ثم امسح رمز QR من طلبك.' },
            { title: 'أدخل الرموز عند الطلب', body: 'إذا لم يظهر خيار المسح، فأدخل عنوان SM-DP+ ورمز التفعيل من طلبك.' },
            { title: 'سمِّ الخط', body: 'سمّه «vela» وأبقِ تجوال البيانات مغلقاً حتى تصل.' },
          ],
        },
        {
          id: 'landing',
          title: 'عند الوصول',
          steps: [
            { title: 'فعّل خط vela', body: 'من الإعدادات › الخلوي في iPhone، أو شرائح SIM في Android.' },
            { title: 'شغّل تجوال البيانات', body: 'لخط vela فقط. التجوال مشمول في باقتك دون رسوم إضافية.' },
            { title: 'اختر vela للبيانات', body: 'اجعل خط vela خط البيانات الخلوية، وأبقِ رقمك المحلي للمكالمات إن شئت.' },
          ],
        },
        {
          id: 'troubleshooting',
          title: 'لا يتصل؟',
          points: [
            'تأكد أن تجوال البيانات مفعّل لخط vela وأنه الخط المختار للبيانات الخلوية.',
            'فعّل وضع الطيران عشر ثوانٍ ثم أوقفه ليبحث هاتفك عن شبكة من جديد.',
            'أعد تشغيل هاتفك.',
            'من إعدادات شبكة الخط، أوقف الاختيار التلقائي للشبكة واختر إحدى شبكات الشركاء المذكورة في صفحة وجهتك.',
            'تأكد أن نقطة الوصول (APN) مضبوطة تلقائياً. إذا ذكرت باقتك نقطة وصول، فأدخلها في إعدادات بيانات الخط.',
            'ما زالت المشكلة قائمة؟ افتح محادثة الدعم في التطبيق مع رقم طلبك، ونرد خلال يوم عمل واحد.',
          ],
        },
        {
          id: 'compatibility',
          title: 'توافق الأجهزة',
          intro: 'تعمل vela على الهواتف التي تدعم eSIM وغير المقفلة على مشغّل.',
          points: [
            'تحقق سريع: اطلب ‎*#06#‎. إذا ظهر رقم EID فهاتفك يدعم eSIM.',
            'iPhone XS وXS Max وXR وكل الطرازات الأحدث، بما فيها iPhone SE (الجيل الثاني وما بعده). قد لا تدعم أجهزة iPhone المشتراة من البر الرئيسي للصين أو هونغ كونغ أو ماكاو شرائح eSIM.',
            'Google Pixel 3 وما بعده، وSamsung Galaxy S20 وما بعده، وZ Flip وZ Fold، والطرازات الحديثة من Motorola وOnePlus وXiaomi وOPPO وغيرها.',
            'إذا اشتريت هاتفك من مشغّل بعقد، فاطلب منه فك القفل قبل السفر.',
          ],
        },
      ],
    },
    stillStuck: {
      title: 'ما زلت بحاجة إلى مساعدة؟',
      body: 'افتح محادثة الدعم في تطبيق vela أو راسلنا بالبريد الإلكتروني. نرد خلال يوم عمل واحد.',
    },
  },
};

export function helpFor(locale: Locale): HelpContent {
  return content[locale];
}
