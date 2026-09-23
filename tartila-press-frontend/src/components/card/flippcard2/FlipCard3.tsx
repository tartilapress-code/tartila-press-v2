// import { useState } from 'react';
// import packages from '@/data/packages.json';

// export default function FlipCard() {
//     const [flipped, setFlipped] = useState<Set<string>>(new Set<string>());

//     const toogleFlipped = (name: string) => {
//         setFlipped((previous) => {
//             const next = new Set(previous);

//             if (next.has(name)) {
//                 next.delete(name);
//             } else {
//                 next.add(name);
//             }

//             return next;
//         });
//     };
//     return (
//         <>
//             <div className="grid grid-cols-3 auto-rows-fr gap-6">
//                 {packages.map((pkg) => {
//                     const isFlipped = flipped.has(pkg.name);

// //                     return (
// //                         <div
// //                             className="w-72 h-96 cursor-pointer [perspective:1000px]"
// //                             onClick={() => toogleFlipped(pkg.name)}
// //                         >
//                             <div
//                                 className={`
//                                         relative w-full h-full
//                                         transition-transform duration-700 transform-3d
//                                         ${isFlipped ? 'rotate-y-180' : ''}
//                                     `}
//                             >
// //                                 {/* Front */}
// //                                 <div
// //                                     className="
// //                                             absolute inset-0
// //                                             flex items-center justify-center
// //                                             rounded-2xl
// //                                             bg-blue-500
// //                                             text-white
// //                                             [backface-visibility:hidden]
// //                                         "
// //                                 >
// //                                     <div className="text-center">
// //                                         <h2 className="text-3xl font-bold">
// //                                             Front
// //                                         </h2>
// //                                         <p className="mt-2">{pkg.name}</p>
// //                                     </div>
// //                                 </div>

// //                                 {/* Back */}
// //                                 <div
// //                                     className="
// //                                             absolute inset-0
// //                                             flex items-center justify-center
// //                                             rounded-2xl
// //                                             bg-purple-500
// //                                             text-white
// //                                             [backface-visibility:hidden]
// //                                             [transform:rotateY(180deg)]
// //                                         "
// //                                 >
// //                                     <div className="text-center">
// //                                         <h2 className="text-3xl font-bold">
// //                                             Back
// //                                         </h2>
// //                                         <p className="mt-2">You flipped me!</p>
// //                                     </div>
// //                                 </div>
//                             </div>
//                         </div>
//                     );
//                 })}
//             </div>
//         </>
//     );
// }
