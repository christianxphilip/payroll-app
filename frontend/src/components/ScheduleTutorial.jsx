const steps = [
  {
    icon: '📅',
    title: 'Pumili ng petsa',
    body: 'Gamitin ang Start Date at End Date para piliin ang mga araw na gusto mong ayusin. Puwede ring gamitin ang Previous Week, Current Week, at Next Week.'
  },
  {
    icon: '➕',
    title: 'Maglagay ng schedule',
    body: 'I-click ang kahon ng empleyado sa napiling araw. Pumili ng Opening, Mid, o Closing shift, tiyaking tama ang oras, at pindutin ang Save.'
  },
  {
    icon: '↔️',
    title: 'Ilipat ang schedule',
    body: 'I-drag ang schedule papunta sa ibang empleyado o petsa. Hintaying matapos ang loading bago gumawa ng susunod na pagbabago.'
  },
  {
    icon: '🎨',
    title: 'Basahin ang mga kulay',
    body: 'Ang background color ay para sa Opening, Mid, o Closing. Ang kulay sa gilid ay nagpapakita kung Kitchen o Bar ang assignment.'
  },
  {
    icon: '🔒',
    title: 'Dual-role staff',
    body: 'Kapag naka-schedule na ang dual-role employee sa kabilang department, magiging gray at read-only ang schedule. Hindi ito puwedeng baguhin ng manager ng kabilang department.'
  },
  {
    icon: '🔄',
    title: 'Automatic ang Google Calendar',
    body: 'Awtomatikong nagsi-sync ang pag-add, edit, move, at delete. Hindi na kailangang paulit-ulit na kumonekta sa Google.'
  },
  {
    icon: '🖼️',
    title: 'I-share ang schedule',
    body: 'Pindutin ang Export Image para gumawa ng horizontal PNG ng napiling date range. Hindi kasama sa manager export ang gray na schedule ng kabilang department.'
  }
];

const ScheduleTutorial = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="schedule-tutorial-title">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 sm:px-7 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-100">Gabay sa Staff</p>
            <h2 id="schedule-tutorial-title" className="text-2xl font-bold mt-1">Paano gamitin ang Schedule</h2>
            <p className="text-sm text-orange-50 mt-1">Madaling gabay para sa paggawa at pag-share ng schedule.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-xl" aria-label="Isara ang tutorial">×</button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center text-xl">{step.icon}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-orange-600 uppercase">Hakbang {index + 1}</span>
                  </div>
                  <h3 className="font-bold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
            <strong>Tip:</strong> Kapag nagkamali, gamitin agad ang Undo habang nakikita pa ang notification. Kung hindi sigurado sa gray na schedule, huwag itong galawin at kausapin ang manager ng kabilang department.
          </div>
        </div>

        <div className="px-5 sm:px-7 py-4 border-t bg-white flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold">
            Naiintindihan ko
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleTutorial;
