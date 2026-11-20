Pod::Spec.new do |s|
  s.name           = 'VelaLiveActivity'
  s.version        = '0.1.0'
  s.summary        = 'Starts, updates and ends the vela trip Live Activity.'
  s.author         = 'vela'
  s.homepage       = 'https://github.com/halalsam/vela'
  s.license        = { type: 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ActivityKit'
  s.source_files   = '**/*.swift'
end
